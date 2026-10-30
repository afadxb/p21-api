const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { sql, config } = require('../db');
const logger = require('../utils/logger');
const { formatDate, formatQuantity, formatPrice, prepareField, formatRecord } = require('../utils/exportFormat');

const EXPORT_SUBDIR = process.env.TMP_OE_EXPORT_DIR || 'exports';
const EXPORT_INTERVAL_MINUTES = parseInt(process.env.TMP_OE_EXPORT_INTERVAL_MINUTES || '5', 10);
const EXPORT_INTERVAL_MS = Number.isFinite(EXPORT_INTERVAL_MINUTES)
  ? Math.max(EXPORT_INTERVAL_MINUTES, 1) * 60 * 1000
  : 5 * 60 * 1000;
const EXPORT_RETENTION_DAYS = parseInt(process.env.TMP_OE_EXPORT_RETENTION_DAYS || '30', 10);

const EXPORTED_FLAG_VALUE = 'Y';

const headerLayout = [
  { key: 'Import_Set_No', zeroPadLength: 4 },
  { key: 'Customer_ID' },
  { key: 'Customer_Name' },
  { key: 'Company_ID' },
  { key: 'Sales_Location_ID' },
  { key: 'Customer_PO_Number' },
  { key: 'Contact_ID' },
  { key: 'Contact_Name' },
  { key: 'Taker' },
  { key: 'Job_Name' },
  { key: 'Order_Date', formatter: formatDate },
  { key: 'Requested_Date', formatter: formatDate },
  { key: 'Quote' },
  { key: 'Approved' },
  { key: 'Ship_To_ID' },
  { key: 'Ship_To_Name' },
  { key: 'Ship_To_Address_1' },
  { key: 'Ship_To_Address_2' },
  { key: 'Ship_To_City' },
  { key: 'Ship_To_State' },
  { key: 'Ship_To_Zip_Code' },
  { key: 'Ship_To_Country' },
  { key: 'Source_Location_ID' },
  { key: 'Carrier_ID' },
  { key: 'Carrier_Name' },
  { key: 'Route' },
  { key: 'Packing_Basis' },
  { key: 'Delivery_Instructions' },
  { key: 'Terms' },
  { key: 'Terms_Desc' },
  { key: 'Will_Call' },
  { key: 'Class_1' },
  { key: 'Class_2' },
  { key: 'Class_3' },
  { key: 'Class_4' },
  { key: 'Class_5' },
  { key: 'RMA_Flag' },
  { key: 'Freight_Code' },
  { key: 'Third_Party_Billing_Flag_Desc' },
  { key: 'Capture_Usage_Default' },
  { key: 'Allocate' },
  { key: 'Contract_Number' },
  { key: 'Invoice_Batch_Number' },
  { key: 'Ship_To_Email_Address' },
  { key: 'Set_Invoice_Exchange_Rate_Source_Desc' },
  { key: 'Ship_To_Phone' },
  { key: 'Currency_ID' },
  { key: 'Apply_Builder_Allowance_Flag' },
  { key: 'Quote_Expiration_Date', formatter: formatDate },
  { key: 'Promise_Date', formatter: formatDate }
];

const lineLayout = [
  { key: 'Import_Set_Number', zeroPadLength: 4 },
  { key: 'Line_No' },
  { key: 'Item_ID' },
  { key: 'Unit_Quantity', formatter: formatQuantity },
  { key: 'Unit_of_Measure' },
  { key: 'Unit_Price', formatter: formatPrice },
  { key: 'Extended_Description' },
  { key: 'Source_Location_ID' },
  { key: 'Ship_Location_ID' },
  { key: 'Product_Group_ID' },
  { key: 'Supplier_ID' },
  { key: 'Supplier_Name' },
  { key: 'Required_Date', formatter: formatDate },
  { key: 'Expedite_Date', formatter: formatDate },
  { key: 'Will_Call' },
  { key: 'Tax_Item' },
  { key: 'OK_to_Interchange' },
  { key: 'Pricing_Unit' },
  { key: 'Commission_Cost', formatter: formatPrice },
  { key: 'Other_Cost', formatter: formatPrice },
  { key: 'PO_Cost', formatter: formatPrice },
  { key: 'Disposition' },
  { key: 'Scheduled' },
  { key: 'Manual_Price_Override' },
  { key: 'Commission_Cost_Edited' },
  { key: 'Other_Cost_Edited' },
  { key: 'Capture_Usage' },
  { key: 'Tag_and_Hold_Class_ID' },
  { key: 'Contract_Bin_ID' },
  { key: 'Contract_No' },
  { key: 'Allocation_Qty', formatter: formatQuantity },
  { key: 'Promise_Date', formatter: formatDate }
];

const noteLayout = [
  { key: 'Import_Set_Number', zeroPadLength: 4 },
  { key: 'Line_No' },
  { key: 'Note_Type' },
  { key: 'Note' },
];

const BIN_ALLOCATION_CUSTOMER_ID = '113378';
const PRIORITY_BIN_PREFIX = 'T0';

const binLayout = [
  { key: 'Import_Set_Number', zeroPadLength: 4 },
  { key: 'Line_No' },
  { key: 'Bin_Code' },
  { key: 'Unit_Quantity', formatter: formatQuantity },
  { key: 'Unit_of_Measure' },
];

async function fetchPendingImportSets(pool) {
  const result = await pool.request().query(`
    SELECT h.Import_Set_No
    FROM TMP_OE_Header h
    WHERE COALESCE(NULLIF(LTRIM(RTRIM(h.Exported)), ''), 'N') <> '${EXPORTED_FLAG_VALUE}'
    GROUP BY h.Import_Set_No
    ORDER BY MIN(TRY_CAST(h.Import_Set_No AS INT));
  `);
  return result.recordset.map((row) => row.Import_Set_No).filter(Boolean);
}

async function fetchHeaderRecord(pool, importSet) {
  const request = pool.request();
  request.input('importSet', sql.NVarChar(8), importSet);
  const result = await request.query(`
    SELECT TOP 1 ${headerLayout.map((f) => f.key).join(', ')}
    FROM TMP_OE_Header
    WHERE Import_Set_No = @importSet
    ORDER BY Import_Set_No;
  `);
  return result.recordset[0];
}

async function fetchLineRecords(pool, importSet) {
  const request = pool.request();
  request.input('importSet', sql.NVarChar(8), importSet);
  const result = await request.query(`
    SELECT ${lineLayout.map((f) => f.key).join(', ')}
    FROM TMP_OE_Line
    WHERE Import_Set_Number = @importSet
    ORDER BY TRY_CAST(Line_No AS INT);
  `);
  return result.recordset;
}

async function fetchNoteRecords(pool, importSet) {
  const request = pool.request();
  request.input('importSet', sql.NVarChar(8), importSet);
  const result = await request.query(`
    SELECT Import_Set_Number, Line_No, 'NOTE' AS Note_Type, Note
    FROM TMP_OE_Line
    WHERE Import_Set_Number = @importSet
      AND Note IS NOT NULL AND LTRIM(RTRIM(Note)) <> ''
    ORDER BY TRY_CAST(Line_No AS INT);
  `);
  return result.recordset;
}

async function fetchBinStock(pool, itemId, locationId, customerId) {
  const request = pool.request();
  request.input('itemId', sql.NVarChar(40), itemId);
  request.input('locationId', sql.Decimal(19, 0), locationId);
  request.input('customerId', sql.Decimal(19, 0), customerId);
  request.input('priorityPrefix', sql.NVarChar(12), `${PRIORITY_BIN_PREFIX}%`);
  // Item_ID may be the customer's part number; resolve it via inv_xref first, then fall back to P21 item_id.
  const result = await request.query(`
    DECLARE @invMastUid INT = (
      SELECT TOP 1 inv_xref.inv_mast_uid
      FROM inv_xref
      WHERE inv_xref.their_item_id = @itemId
        AND inv_xref.customer_id = @customerId
    );
    IF @invMastUid IS NULL
      SELECT @invMastUid = inv_mast_uid FROM inv_mast WHERE item_id = @itemId;

    SELECT inv_bin.bin AS Bin_Code,
           inv_bin.quantity - ISNULL(inv_bin.qty_allocated, 0) AS Available_Qty
    FROM inv_bin
    INNER JOIN bin ON bin.bin_id = inv_bin.bin
      AND bin.location_id = inv_bin.location_id
      AND bin.delete_flag = 'N'
    INNER JOIN inv_loc ON inv_loc.location_id = inv_bin.location_id
      AND inv_loc.inv_mast_uid = inv_bin.inv_mast_uid
    INNER JOIN bin_type ON bin_type.bin_type_uid = bin.bin_type_uid
    WHERE inv_bin.inv_mast_uid = @invMastUid
      AND inv_bin.location_id = @locationId
      AND bin_type.pickable_flag = 'Y'
      AND bin_type.quarantine_flag = 'N'
      AND inv_bin.quantity - ISNULL(inv_bin.qty_allocated, 0) > 0
    ORDER BY CASE WHEN inv_bin.bin LIKE @priorityPrefix THEN 0 ELSE 1 END, inv_bin.bin;
  `);
  return result.recordset.map((row) => ({
    Bin_Code: row.Bin_Code,
    Available_Qty: Number(row.Available_Qty),
    Is_Priority: String(row.Bin_Code).toUpperCase().startsWith(PRIORITY_BIN_PREFIX),
  }));
}

function roundQty(value) {
  return Number(Number(value).toFixed(4));
}

function isBinAllocationCustomer(headerRecord) {
  const id = Number(headerRecord?.Customer_ID);
  return Number.isFinite(id) && String(id) === BIN_ALLOCATION_CUSTOMER_ID;
}

async function buildBinAllocations(pool, importSet, headerRecord, lineRecords) {
  if (!isBinAllocationCustomer(headerRecord)) {
    return [];
  }

  const stockCache = new Map();
  const allocations = [];

  for (const line of lineRecords) {
    let remaining = roundQty(line.Unit_Quantity);
    const locationId = line.Source_Location_ID || headerRecord.Source_Location_ID || headerRecord.Sales_Location_ID;

    if (!line.Item_ID || !locationId || !(remaining > 0)) {
      logger.warn(
        { importSet, lineNo: line.Line_No, itemId: line.Item_ID, locationId },
        'Skipping bin allocation: missing item, location or quantity'
      );
      continue;
    }

    const cacheKey = `${line.Item_ID}|${locationId}`;
    if (!stockCache.has(cacheKey)) {
      stockCache.set(cacheKey, await fetchBinStock(pool, line.Item_ID, locationId, headerRecord.Customer_ID));
    }

    const bins = stockCache.get(cacheKey);
    // Only allocate when T0 stock exists; T0 bins first, then top up from other pickable bins.
    if (!bins.some((bin) => bin.Is_Priority && bin.Available_Qty > 0)) {
      logger.info(
        { importSet, lineNo: line.Line_No, itemId: line.Item_ID, locationId },
        `No ${PRIORITY_BIN_PREFIX} bin stock; leaving allocation to P21`
      );
      continue;
    }

    for (const bin of bins) {
      if (remaining <= 0) {
        break;
      }
      if (bin.Available_Qty <= 0) {
        continue;
      }

      const qty = roundQty(Math.min(remaining, bin.Available_Qty));
      allocations.push({
        Import_Set_Number: line.Import_Set_Number,
        Line_No: line.Line_No,
        Bin_Code: bin.Bin_Code,
        Unit_Quantity: qty,
        Unit_of_Measure: line.Unit_of_Measure,
      });
      bin.Available_Qty = roundQty(bin.Available_Qty - qty);
      remaining = roundQty(remaining - qty);
    }

    if (remaining > 0) {
      logger.warn(
        { importSet, lineNo: line.Line_No, itemId: line.Item_ID, locationId, unallocated: remaining },
        'Insufficient pickable bin stock to fully allocate line; remainder left to P21'
      );
    }
  }

  return allocations;
}

async function markHeaderExported(pool, importSet) {
  const request = pool.request();
  request.input('importSet', sql.NVarChar(8), importSet);
  await request.query(`
    UPDATE TMP_OE_Header
    SET Exported = '${EXPORTED_FLAG_VALUE}'
    WHERE Import_Set_No = @importSet;
  `);
}

async function writeFiles(importSet, headerRecord, lineRecords, noteRecords, binRecords) {
  if (!headerRecord) {
    throw new Error(`Missing TMP_OE_Header record for import set ${importSet}`);
  }

  const baseDir = path.join(__dirname, '..', EXPORT_SUBDIR);
  await fs.mkdir(baseDir, { recursive: true });

  const headerContent = formatRecord(headerRecord, headerLayout) + os.EOL;
  const lineContent = lineRecords.map((record) => formatRecord(record, lineLayout)).join(os.EOL) + os.EOL;

  const headerFile = path.join(baseDir, `SOH${importSet}.txt`);
  const lineFile = path.join(baseDir, `SOL${importSet}.txt`);

  await fs.writeFile(headerFile, headerContent, 'utf8');
  await fs.writeFile(lineFile, lineContent, 'utf8');

  const result = { headerFile, lineFile };

  if (noteRecords && noteRecords.length > 0) {
    const noteContent = noteRecords.map((record) => formatRecord(record, noteLayout)).join(os.EOL) + os.EOL;
    const noteFile = path.join(baseDir, `SONL${importSet}.txt`);
    await fs.writeFile(noteFile, noteContent, 'utf8');
    result.noteFile = noteFile;
  }

  if (binRecords && binRecords.length > 0) {
    const binContent = binRecords.map((record) => formatRecord(record, binLayout)).join(os.EOL) + os.EOL;
    const binFile = path.join(baseDir, `SOB${importSet}.txt`);
    await fs.writeFile(binFile, binContent, 'utf8');
    result.binFile = binFile;
  }

  return result;
}

async function exportImportSet(pool, importSet) {
  const headerRecord = await fetchHeaderRecord(pool, importSet);
  const lineRecords = await fetchLineRecords(pool, importSet);

  if (!headerRecord) {
    logger.warn({ importSet }, 'No header found for import set; skipping export');
    return;
  }

  if (!lineRecords || lineRecords.length === 0) {
    logger.warn({ importSet }, 'No lines found for import set; skipping export');
    return;
  }

  const noteRecords = await fetchNoteRecords(pool, importSet);
  const binRecords = await buildBinAllocations(pool, importSet, headerRecord, lineRecords);
  const files = await writeFiles(importSet, headerRecord, lineRecords, noteRecords, binRecords);
  await markHeaderExported(pool, importSet);
  logger.info({ importSet, headerFile: files.headerFile, lineFile: files.lineFile, noteFile: files.noteFile || null, binFile: files.binFile || null }, 'Exported TMP_OE records');
}

async function runExportCycle() {
  let pool;
  try {
    pool = await sql.connect(config);
    const importSets = await fetchPendingImportSets(pool);

    for (const importSet of importSets) {
      try {
        await exportImportSet(pool, importSet);
      } catch (err) {
        logger.error({ err, importSet }, 'Failed to export import set');
      }
    }
  } catch (err) {
    logger.error({ err }, 'TMP_OE export job failed to run');
  }
  // Don't close the pool: sql.connect returns the global pool shared with the routes and the PO export job
}

async function cleanupOldExports() {
  const baseDir = path.join(__dirname, '..', EXPORT_SUBDIR);
  const retentionMs = EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;

  try {
    const files = await fs.readdir(baseDir);
    const exportFiles = files.filter((f) => /^SO(?:H|L|NL|B)\d+\.txt$/i.test(f));

    for (const file of exportFiles) {
      const filePath = path.join(baseDir, file);
      try {
        const stat = await fs.stat(filePath);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(filePath);
          logger.info({ file }, 'Cleaned up old export file');
        }
      } catch (err) {
        logger.warn({ err, file }, 'Failed to check/remove export file');
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn({ err }, 'Failed to read exports directory for cleanup');
    }
  }
}

let timer = null;
let running = false;

async function startExportJob() {
  if (running) {
    return;
  }
  running = true;

  await cleanupOldExports();
  await runExportCycle();

  timer = setInterval(async () => {
    await cleanupOldExports();
    await runExportCycle();
  }, EXPORT_INTERVAL_MS);
  timer.unref?.();
}

function stopExportJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
  logger.info('Export job stopped');
}

module.exports = {
  startExportJob,
  stopExportJob,
  _private: {
    formatRecord,
    headerLayout,
    lineLayout,
    binLayout,
    isBinAllocationCustomer,
    buildBinAllocations,
    formatDate,
    formatQuantity,
    formatPrice,
    prepareField
  }
};
