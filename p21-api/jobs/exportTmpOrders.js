const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { sql, config } = require('../db');

const EXPORT_SUBDIR = process.env.TMP_OE_EXPORT_DIR || 'exports';
const EXPORT_INTERVAL_MINUTES = parseInt(process.env.TMP_OE_EXPORT_INTERVAL_MINUTES || '30', 10);
const EXPORT_INTERVAL_MS = Number.isFinite(EXPORT_INTERVAL_MINUTES)
  ? Math.max(EXPORT_INTERVAL_MINUTES, 1) * 60 * 1000
  : 30 * 60 * 1000;

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

function normaliseYear(yearPart) {
  if (!yearPart) {
    return '';
  }

  if (yearPart.length === 2) {
    const yearNumber = Number(yearPart);
    if (Number.isNaN(yearNumber)) {
      return yearPart;
    }
    return yearNumber >= 70 ? `19${yearPart}` : `20${yearPart}`;
  }

  return yearPart;
}

function formatDate(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }

  if (/^\d{8}$/.test(value)) {
    if (value === '00000000') {
      return '';
    }

    const maybeMonth = Number(value.slice(0, 2));

    if (Number.isFinite(maybeMonth) && maybeMonth > 12) {
      const year = value.slice(0, 4);
      const month = value.slice(4, 6);
      const day = value.slice(6, 8);
      return `${month}/${day}/${normaliseYear(year)}`;
    }

    const month = value.slice(0, 2);
    const day = value.slice(2, 4);
    const year = value.slice(4, 8);
    return `${month}/${day}/${normaliseYear(year)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (value === '0000-00-00') {
      return '';
    }

    const [year, month, day] = value.split('-');
    return `${month}/${day}/${normaliseYear(year)}`;
  }

  return value;
}

function formatQuantity(raw) {
  if (raw === null || raw === undefined) {
    return '';
  }
  const num = Number(raw);
  if (Number.isNaN(num)) {
    return String(raw);
  }
  if (Number.isInteger(num)) {
    return String(num);
  }
  return num.toString();
}

function formatPrice(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return '';
  }
  const num = Number(raw);
  if (Number.isNaN(num)) {
    return String(raw);
  }
  const trimmed = num.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return trimmed || '0';
}

function prepareField(value, { width, zeroPadLength }) {
  let output = value === null || value === undefined ? '' : String(value).trim();

  if (zeroPadLength && output) {
    output = output.padStart(zeroPadLength, '0');
  }

  if (width && output.length > width) {
    output = output.slice(0, width);
  }

  return output;
}

function formatRecord(record, layout) {
  return layout
    .map((field) => {
      const rawValue = record[field.key];
      const value = field.formatter ? field.formatter(rawValue, record) : rawValue;
      return prepareField(value, field);
    })
    .join('\t');
}

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

async function markHeaderExported(pool, importSet) {
  const request = pool.request();
  request.input('importSet', sql.NVarChar(8), importSet);
  await request.query(`
    UPDATE TMP_OE_Header
    SET Exported = '${EXPORTED_FLAG_VALUE}'
    WHERE Import_Set_No = @importSet;
  `);
}

async function writeFiles(importSet, headerRecord, lineRecords) {
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

  return { headerFile, lineFile };
}

async function exportImportSet(pool, importSet) {
  const headerRecord = await fetchHeaderRecord(pool, importSet);
  const lineRecords = await fetchLineRecords(pool, importSet);

  if (!headerRecord) {
    console.warn(`No header found for import set ${importSet}; skipping export.`);
    return;
  }

  if (!lineRecords || lineRecords.length === 0) {
    console.warn(`No lines found for import set ${importSet}; skipping export.`);
    return;
  }

  const files = await writeFiles(importSet, headerRecord, lineRecords);
  await markHeaderExported(pool, importSet);
  console.log(`Exported TMP_OE records for import set ${importSet} to ${files.headerFile} and ${files.lineFile}`);
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
        console.error(`Failed to export import set ${importSet}:`, err);
      }
    }
  } catch (err) {
    console.error('TMP_OE export job failed to run:', err);
  } finally {
    if (pool) {
      pool.close();
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

  await runExportCycle();

  timer = setInterval(runExportCycle, EXPORT_INTERVAL_MS);
  timer.unref?.();
}

function stopExportJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
}

module.exports = {
  startExportJob,
  stopExportJob,
  _private: {
    formatRecord,
    headerLayout,
    lineLayout,
    formatDate,
    formatQuantity,
    formatPrice,
    prepareField
  }
};
