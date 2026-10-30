const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');
const logger = require('../../../utils/logger');
const asyncHandler = require('../../../utils/asyncHandler');

// Layout per docs/PurchaseOrderHeader.xlsx and docs/PurchaseOrderLine.xlsx
const headerFields = [
  { column: 'Import_Set_No', key: 'importSetNo', type: sql.NVarChar(8), derived: true },
  { column: 'Company_ID', key: 'companyId', type: sql.NVarChar(8), required: true },
  { column: 'Location_ID', key: 'locationId', type: sql.Decimal(19, 0), required: true, numeric: true },
  { column: 'Vendor_ID', key: 'vendorId', type: sql.Decimal(19, 0), required: true, numeric: true },
  { column: 'Supplier_ID', key: 'supplierId', type: sql.Decimal(19, 0), required: true, numeric: true },
  { column: 'Division_ID', key: 'divisionId', type: sql.Decimal(19, 0), numeric: true },
  { column: 'Buyer_ID', key: 'buyerId', type: sql.Decimal(19, 0), required: true, numeric: true },
  { column: 'Purchase_Group_ID', key: 'purchaseGroupId', type: sql.NVarChar(8) },
  { column: 'Purchase_Order_Type', key: 'purchaseOrderType', type: sql.NVarChar(1), flag: true },
  { column: 'Purchase_Order_Date', key: 'purchaseOrderDate', type: sql.NVarChar(10) },
  { column: 'Required_Date', key: 'requiredDate', type: sql.NVarChar(10) },
  { column: 'Approved', key: 'approved', type: sql.NVarChar(1), flag: true },
  { column: 'Terms', key: 'terms', type: sql.NVarChar(20) },
  { column: 'Carrier_ID', key: 'carrierId', type: sql.NVarChar(8) },
  { column: 'Shipping_Instructions', key: 'shippingInstructions', type: sql.NVarChar(100) },
  { column: 'Receipt_Date', key: 'receiptDate', type: sql.NVarChar(10) },
  { column: 'Class_1_ID', key: 'class1Id', type: sql.NVarChar(8) },
  { column: 'Class_2_ID', key: 'class2Id', type: sql.NVarChar(8) },
  { column: 'Class_3_ID', key: 'class3Id', type: sql.NVarChar(8) },
  { column: 'Class_4_ID', key: 'class4Id', type: sql.NVarChar(8) },
  { column: 'Class_5_ID', key: 'class5Id', type: sql.NVarChar(8) },
  { column: 'External_PO_No', key: 'externalPoNo', type: sql.NVarChar(40) },
  { column: 'Printed', key: 'printed', type: sql.NVarChar(1), flag: true },
  { column: 'Contact_ID', key: 'contactId', type: sql.NVarChar(8) },
  { column: 'Contact_Name', key: 'contactName', type: sql.NVarChar(40) },
  { column: 'Historical_Complete', key: 'historicalComplete', type: sql.NVarChar(1), flag: true },
  { column: 'EDI', key: 'edi', type: sql.NVarChar(1), flag: true },
  { column: 'Delivery_Terms', key: 'deliveryTerms', type: sql.NVarChar(20) },
  { column: 'Special_Terms', key: 'specialTerms', type: sql.NVarChar(20) },
  { column: 'Handling_Code_Type', key: 'handlingCodeType', type: sql.NVarChar(20) },
  { column: 'Trans_Handling_Unit', key: 'transHandlingUnit', type: sql.NVarChar(20) },
  { column: 'Handling_Code_Time', key: 'handlingCodeTime', type: sql.NVarChar(20) },
  { column: 'Brand_Name', key: 'brandName', type: sql.NVarChar(20) },
  { column: 'Carrier_Ship_Method', key: 'carrierShipMethod', type: sql.NVarChar(20) },
  { column: 'Carrier_Priority', key: 'carrierPriority', type: sql.NVarChar(20) },
  { column: 'Packing_Basis', key: 'packingBasis', type: sql.NVarChar(16), required: true }
];

const lineFields = [
  { column: 'Import_Set_No', key: 'importSetNo', type: sql.NVarChar(8), derived: true },
  { column: 'Line_Number', key: 'lineNumber', type: sql.Decimal(19, 0), numeric: true, derived: true },
  { column: 'Item_ID', key: 'itemId', type: sql.NVarChar(40), required: true },
  { column: 'Unit_of_Measure', key: 'unitOfMeasure', type: sql.NVarChar(8), required: true },
  { column: 'Unit_Quantity', key: 'unitQuantity', type: sql.Decimal(19, 4), required: true, numeric: true },
  { column: 'Pricing_Unit', key: 'pricingUnit', type: sql.NVarChar(8) },
  { column: 'Unit_Price_Display', key: 'unitPriceDisplay', type: sql.Decimal(19, 6), numeric: true },
  { column: 'Required_Date', key: 'requiredDate', type: sql.NVarChar(10) },
  { column: 'Date_Due', key: 'dateDue', type: sql.NVarChar(10) },
  { column: 'Extended_Description', key: 'extendedDescription', type: sql.NVarChar(255) },
  { column: 'Supplier_Ship_Date', key: 'supplierShipDate', type: sql.NVarChar(10) },
  { column: 'Revision_Level', key: 'revisionLevel', type: sql.NVarChar(20) }
];

const DEFAULT_PURCHASE_ORDER_TYPE = 'D';

const headerColumnList = headerFields.map((f) => f.column).join(', ');
const headerParamList = headerFields.map((f) => `@${f.column}`).join(', ');
const lineColumnList = lineFields.map((f) => f.column).join(', ');
const lineParamList = lineFields.map((f) => `@${f.column}`).join(', ');

const isEmpty = (value) => value === undefined || value === null || value === '';

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function validateRecord(record, fields, recordName) {
  const missing = fields
    .filter((field) => field.required && !field.derived && isEmpty(record?.[field.key]))
    .map((field) => field.key);

  if (missing.length > 0) {
    throw badRequest(`${recordName} missing required field(s): ${missing.join(', ')}`);
  }

  const invalidNumeric = fields
    .filter((field) => field.numeric && !field.derived && !isEmpty(record?.[field.key]))
    .filter((field) => Number.isNaN(Number(record[field.key])))
    .map((field) => field.key);

  if (invalidNumeric.length > 0) {
    throw badRequest(`${recordName} has non-numeric value(s) for: ${invalidNumeric.join(', ')}`);
  }

  const tooLong = fields
    .filter((field) => !field.numeric && field.type.length && !isEmpty(record?.[field.key]))
    .filter((field) => String(record[field.key]).trim().length > field.type.length)
    .map((field) => `${field.key} (max ${field.type.length})`);

  if (tooLong.length > 0) {
    throw badRequest(`${recordName} has value(s) that are too long: ${tooLong.join(', ')}`);
  }
}

function normaliseValue(value, field) {
  if (isEmpty(value)) {
    return null;
  }

  if (field.numeric) {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  }

  const text = String(value).trim();
  return field.flag ? text.toUpperCase() : text;
}

router.post('/', asyncHandler(async (req, res) => {
    const { purchaseOrders } = req.body || {};

    let ordersPayload;
    if (Array.isArray(purchaseOrders) && purchaseOrders.length > 0) {
      ordersPayload = purchaseOrders;
    } else if (req.body && req.body.header && Array.isArray(req.body.lines)) {
      ordersPayload = [{ header: req.body.header, lines: req.body.lines }];
    } else {
      throw badRequest('Request body must contain at least one purchase order with header and lines');
    }

    ordersPayload.forEach((order, orderIndex) => {
      if (!order || typeof order !== 'object') {
        throw badRequest(`Purchase order ${orderIndex + 1} must be an object`);
      }

      const { header, lines } = order;

      if (!header || typeof header !== 'object') {
        throw badRequest(`Purchase order ${orderIndex + 1} is missing a header object`);
      }

      validateRecord(header, headerFields, `Purchase order ${orderIndex + 1} header`);

      if (!Array.isArray(lines) || lines.length === 0) {
        throw badRequest(`Purchase order ${orderIndex + 1} must contain at least one line item`);
      }

      lines.forEach((line, lineIndex) => {
        validateRecord(line, lineFields, `Purchase order ${orderIndex + 1} line ${lineIndex + 1}`);
      });
    });

    const pool = await sql.connect(config);
    const transaction = new sql.Transaction(pool);

    try { // transaction scope
      await transaction.begin();

      const lastImportSetNoRequest = new sql.Request(transaction);
      const lastResult = await lastImportSetNoRequest.query(`
        SELECT ISNULL(MAX(CAST(Import_Set_No AS INT)), 0) AS lastImportSetNo
        FROM TMP_PO_Header WITH (UPDLOCK, HOLDLOCK);
      `);

      let nextImportSetNo = Number(lastResult.recordset?.[0]?.lastImportSetNo) || 0;

      const responseOrders = [];

      for (const order of ordersPayload) {
        const currentImportSetNo = String(++nextImportSetNo);
        const headerValues = { ...order.header, importSetNo: currentImportSetNo };
        if (isEmpty(headerValues.purchaseOrderType)) {
          headerValues.purchaseOrderType = DEFAULT_PURCHASE_ORDER_TYPE;
        }
        if (isEmpty(headerValues.approved)) {
          headerValues.approved = 'N';
        }
        const headerRequest = new sql.Request(transaction);
        headerFields.forEach((field) => {
          headerRequest.input(
            field.column,
            field.type,
            normaliseValue(headerValues[field.key], field)
          );
        });

        await headerRequest.query(`
          INSERT INTO TMP_PO_Header (${headerColumnList})
          VALUES (${headerParamList});
        `);

        let linesInserted = 0;
        for (const [index, originalLine] of order.lines.entries()) {
          const line = {
            ...originalLine,
            importSetNo: currentImportSetNo,
            lineNumber: index + 1,
            // P21 rejects the import unless Item_ID is upper case
            itemId: String(originalLine.itemId).trim().toUpperCase()
          };
          const lineRequest = new sql.Request(transaction);
          lineFields.forEach((field) => {
            lineRequest.input(
              field.column,
              field.type,
              normaliseValue(line[field.key], field)
            );
          });
          await lineRequest.query(`
            INSERT INTO TMP_PO_Line (${lineColumnList})
            VALUES (${lineParamList});
          `);
          linesInserted += 1;
        }

        const responseOrder = {
          importSetNo: currentImportSetNo,
          linesInserted
        };

        if (!isEmpty(headerValues.externalPoNo)) {
          responseOrder.externalPoNo = headerValues.externalPoNo;
        }

        responseOrders.push(responseOrder);
      }

      await transaction.commit();

      res.status(201).json({
        message: 'Purchase orders Accepted',
        purchaseOrders: responseOrders
      });
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        logger.error({ err: rollbackErr }, 'Failed to rollback transaction');
      }
      throw err;
    }
}));

module.exports = router;
