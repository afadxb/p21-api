// Node.js module for generating fixed-layout tab-delimited order files based on uploaded template structure

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Fixed column layout extracted from templates (FULL LAYOUT as per provided templates)
const headerColumns = [
  "Import Set Number", "Order No", "Customer ID", "Order Date", "Ship To Name", "Ship To Address1", "Ship To Address2", "Ship To City", "Ship To State", "Ship To Zip", "Ship To Country", "PO No", "Job Price Header UID", "Delete Flag", "Completed", "Company ID", "Date Created", "Currency", "Exchange Rate", "Terms", "Freight Amount", "Tax Amount", "Total Amount", "Discount Amount", "Payment Method", "Credit Card Number", "Credit Card Expiration", "Billing Address", "Billing City", "Billing State", "Billing Zip", "Billing Country", "Sales Rep", "Notes", "Custom Field 1", "Custom Field 2", "Custom Field 3", "Custom Field 4", "Custom Field 5", "Web Order", "Web Customer ID"
];

const lineColumns = [
  "Import Set Number", "Line No", "Item ID", "Unit Quantity", "Unit of Measure", "Unit Price", "Extended Description", "Source Location ID", "Ship Location ID", "Product Group ID", "Supplier ID", "Supplier Name", "Required Date", "Expedite Date", "Will Call", "Tax Item", "OK to Interchange", "Pricing Unit", "Commission Cost", "Other Cost", "PO Cost", "Disposition", "Scheduled", "Manual Price Override", "Commission Cost Edited", "Other Cost Edited", "Capture Usage", "Tag and Hold Class ID", "Contract Bin ID", "Contract No.", "Allocation Qty", "Promise Date", "Revision Level", "Resolve Item Contract", "Sample", "Quote Line No.", "Quote Complete", "Item Description", "Invoice No.", "Line No.1", "Line Custom Field 1", "Line Custom Field 2", "Line Custom Field 3", "Line Custom Field 4", "Line Custom Field 5", "Line Web Order Ref", "Line Web Customer Ref"
];

function generateImportSetNumber() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function formatTabDelimitedLine(data, columns) {
  return columns.map(col => (data[col] !== undefined ? data[col] : "")).join("\t");
}

function generateOrderFilesStrict(orderHeader, orderLines, outputPath) {
  const importSetNumber = generateImportSetNumber();
  orderHeader["Import Set Number"] = importSetNumber;
  orderLines.forEach(line => {
    line["Import Set Number"] = importSetNumber;
  });

  const orderId = orderHeader["Order No"] || Date.now();
  const headerFile = `order_${orderId}_header.txt`;
  const linesFile = `order_${orderId}_lines.txt`;

  const headerHeader = headerColumns.join("\t");
  const lineHeader = lineColumns.join("\t");

  const headerLine = formatTabDelimitedLine(orderHeader, headerColumns);
  const linesContent = orderLines.map(line => formatTabDelimitedLine(line, lineColumns)).join("\n");

  fs.mkdirSync(outputPath, { recursive: true });
  fs.writeFileSync(path.join(outputPath, headerFile), headerHeader + "\n" + headerLine + "\n", { encoding: "utf8" });
  fs.writeFileSync(path.join(outputPath, linesFile), lineHeader + "\n" + linesContent + "\n", { encoding: "utf8" });

  return {
    headerFile: path.join(outputPath, headerFile),
    linesFile: path.join(outputPath, linesFile),
    orderId,
    importSetNumber
  };
}

module.exports = {
  generateOrderFilesStrict,
  headerColumns,
  lineColumns
};
