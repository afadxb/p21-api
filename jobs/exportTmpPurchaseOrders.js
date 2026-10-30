const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { sql, config } = require('../db');
const logger = require('../utils/logger');
const { formatDate, formatQuantity, formatRecord } = require('../utils/exportFormat');

const EXPORT_SUBDIR = process.env.TMP_PO_EXPORT_DIR || 'exports';
const EXPORT_INTERVAL_MINUTES = parseInt(process.env.TMP_PO_EXPORT_INTERVAL_MINUTES || '5', 10);
const EXPORT_INTERVAL_MS = Number.isFinite(EXPORT_INTERVAL_MINUTES)
  ? Math.max(EXPORT_INTERVAL_MINUTES, 1) * 60 * 1000
  : 5 * 60 * 1000;
const EXPORT_RETENTION_DAYS = parseInt(process.env.TMP_PO_EXPORT_RETENTION_DAYS || '30', 10);

const EXPORTED_FLAG_VALUE = 'Y';

// Column order per docs/PurchaseOrderHeader.xlsx
const headerLayout = [
  { key: 'Import_Set_No', zeroPadLength: 4 },
  { key: 'Company_ID' },
  { key: 'Location_ID' },
  { key: 'Vendor_ID' },
  { key: 'Supplier_ID' },
  { key: 'Division_ID' },
  { key: 'Buyer_ID' },
  { key: 'Purchase_Group_ID' },
  { key: 'Purchase_Order_Type' },
  { key: 'Purchase_Order_Date', formatter: formatDate },
  { key: 'Required_Date', formatter: formatDate },
  { key: 'Approved' },
  { key: 'Terms' },
  { key: 'Carrier_ID' },
  { key: 'Shipping_Instructions' },
  { key: 'Receipt_Date', formatter: formatDate },
  { key: 'Class_1_ID' },
  { key: 'Class_2_ID' },
  { key: 'Class_3_ID' },
  { key: 'Class_4_ID' },
  { key: 'Class_5_ID' },
  { key: 'External_PO_No' },
  { key: 'Printed' },
  { key: 'Contact_ID' },
  { key: 'Contact_Name' },
  { key: 'Historical_Complete' },
  { key: 'EDI' },
  { key: 'Delivery_Terms' },
  { key: 'Special_Terms' },
  { key: 'Handling_Code_Type' },
  { key: 'Trans_Handling_Unit' },
  { key: 'Handling_Code_Time' },
  { key: 'Brand_Name' },
  { key: 'Carrier_Ship_Method' },
  { key: 'Carrier_Priority' },
  { key: 'Packing_Basis' }
];

// Column order per docs/PurchaseOrderLine.xlsx
const lineLayout = [
  { key: 'Import_Set_No', zeroPadLength: 4 },
  { key: 'Line_Number' },
  { key: 'Item_ID' },
  { key: 'Unit_of_Measure' },
  { key: 'Unit_Quantity', formatter: formatQuantity },
  { key: 'Pricing_Unit' },
  // Not formatPrice: that rounds to 4 decimals and PO costs can carry 6
  { key: 'Unit_Price_Display', formatter: formatQuantity },
  { key: 'Required_Date', formatter: formatDate },
  { key: 'Date_Due', formatter: formatDate },
  { key: 'Extended_Description' },
  { key: 'Supplier_Ship_Date', formatter: formatDate },
  { key: 'Revision_Level' }
];

async function fetchPendingImportSets(pool) {
  const result = await pool.request().query(`
    SELECT h.Import_Set_No
    FROM TMP_PO_Header h
    WHERE COALESCE(NULLIF(LTRIM(RTRIM(h.Exported)), ''), 'N') <> '${EXPORTED_FLAG_VALUE}'
    ORDER BY TRY_CAST(h.Import_Set_No AS INT);
  `);
  return result.recordset.map((row) => row.Import_Set_No).filter(Boolean);
}

async function fetchHeaderRecord(pool, importSet) {
  const request = pool.request();
  request.input('importSet', sql.NVarChar(8), importSet);
  const result = await request.query(`
    SELECT TOP 1 ${headerLayout.map((f) => f.key).join(', ')}
    FROM TMP_PO_Header
    WHERE Import_Set_No = @importSet;
  `);
  return result.recordset[0];
}

async function fetchLineRecords(pool, importSet) {
  const request = pool.request();
  request.input('importSet', sql.NVarChar(8), importSet);
  const result = await request.query(`
    SELECT ${lineLayout.map((f) => f.key).join(', ')}
    FROM TMP_PO_Line
    WHERE Import_Set_No = @importSet
    ORDER BY Line_Number;
  `);
  return result.recordset;
}

async function markHeaderExported(pool, importSet) {
  const request = pool.request();
  request.input('importSet', sql.NVarChar(8), importSet);
  await request.query(`
    UPDATE TMP_PO_Header
    SET Exported = '${EXPORTED_FLAG_VALUE}'
    WHERE Import_Set_No = @importSet;
  `);
}

async function writeFiles(importSet, headerRecord, lineRecords) {
  const baseDir = path.join(__dirname, '..', EXPORT_SUBDIR);
  await fs.mkdir(baseDir, { recursive: true });

  const headerContent = formatRecord(headerRecord, headerLayout) + os.EOL;
  const lineContent = lineRecords.map((record) => formatRecord(record, lineLayout)).join(os.EOL) + os.EOL;

  const headerFile = path.join(baseDir, `POH${importSet}.txt`);
  const lineFile = path.join(baseDir, `POL${importSet}.txt`);

  await fs.writeFile(headerFile, headerContent, 'utf8');
  await fs.writeFile(lineFile, lineContent, 'utf8');

  return { headerFile, lineFile };
}

async function exportImportSet(pool, importSet) {
  const headerRecord = await fetchHeaderRecord(pool, importSet);
  const lineRecords = await fetchLineRecords(pool, importSet);

  if (!headerRecord) {
    logger.warn({ importSet }, 'No PO header found for import set; skipping export');
    return;
  }

  if (!lineRecords || lineRecords.length === 0) {
    logger.warn({ importSet }, 'No PO lines found for import set; skipping export');
    return;
  }

  const files = await writeFiles(importSet, headerRecord, lineRecords);
  await markHeaderExported(pool, importSet);
  logger.info({ importSet, headerFile: files.headerFile, lineFile: files.lineFile }, 'Exported TMP_PO records');
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
        logger.error({ err, importSet }, 'Failed to export PO import set');
      }
    }
  } catch (err) {
    logger.error({ err }, 'TMP_PO export job failed to run');
  }
}

async function cleanupOldExports() {
  const baseDir = path.join(__dirname, '..', EXPORT_SUBDIR);
  const retentionMs = EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;

  try {
    const files = await fs.readdir(baseDir);
    const exportFiles = files.filter((f) => /^PO(?:H|L)\d+\.txt$/i.test(f));

    for (const file of exportFiles) {
      const filePath = path.join(baseDir, file);
      try {
        const stat = await fs.stat(filePath);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(filePath);
          logger.info({ file }, 'Cleaned up old PO export file');
        }
      } catch (err) {
        logger.warn({ err, file }, 'Failed to check/remove PO export file');
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn({ err }, 'Failed to read exports directory for PO cleanup');
    }
  }
}

let timer = null;
let running = false;

async function startPurchaseOrderExportJob() {
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

function stopPurchaseOrderExportJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
  logger.info('PO export job stopped');
}

module.exports = {
  startPurchaseOrderExportJob,
  stopPurchaseOrderExportJob,
  _private: {
    headerLayout,
    lineLayout
  }
};
