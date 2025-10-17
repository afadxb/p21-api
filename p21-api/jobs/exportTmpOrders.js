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
  { key: 'Import_Set_No', width: 8, zeroPadLength: 4 },
  { key: 'Customer_ID', width: 16 },
  { key: 'Customer_Name', width: 16 },
  { key: 'Customer_PO_Number', width: 24 },
  { key: 'Taker', width: 16 },
  { key: 'Order_Date', width: 40, formatter: formatDate },
  { key: 'Ship_To_ID', width: 7 },
  { key: 'Ship_To_Name', width: 17 },
  { key: 'Ship_To_Address_1', width: 24 },
  { key: 'Ship_To_City', width: 16 },
  { key: 'Ship_To_State', width: 8 },
  { key: 'Ship_To_Zip_Code', width: 8 },
  { key: 'Ship_To_Country', width: 55 },
  { key: 'Terms_Desc', width: 113 },
  { key: 'Contract_Number', width: 6 }
];

const lineLayout = [
  { key: 'Import_Set_Number', width: 8, zeroPadLength: 4 },
  { key: 'Line_No', width: 8 },
  { key: 'Item_ID', width: 16 },
  { key: 'Unit_Quantity', width: 8, formatter: formatQuantity },
  { key: 'Unit_of_Measure', width: 8 },
  { key: 'Unit_Price', width: 9, formatter: formatPrice },
  { key: 'Extended_Description', width: 55 },
  { key: 'Required_Date', width: 15, formatter: formatDate },
  { key: 'Pricing_Unit', width: 2 }
];

function formatDate(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }

  if (/^\d{8}$/.test(value)) {
    const firstPart = value.slice(0, 2);
    const secondPart = value.slice(2, 4);
    const lastPart = value.slice(4);

    if (Number(firstPart) > 12) {
      const year = value.slice(0, 4);
      const month = value.slice(4, 6);
      const day = value.slice(6, 8);
      return `${month}/${day}/${year.slice(-2)}`;
    }

    return `${firstPart}/${secondPart}/${lastPart.slice(-2)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${month}/${day}/${year.slice(-2)}`;
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
