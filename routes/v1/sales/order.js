const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');
// const { apiKeyAuth } = require('../../../middleware/apiKeyAuth');
// router.use(apiKeyAuth('/v1/sales/order'));

const headerFields = [
  { column: 'Import_Set_No', key: 'importSetNo', type: sql.NVarChar(8), derived: true },
  { column: 'Customer_ID', key: 'customerId', type: sql.Decimal(18, 2), required: true, numeric: true },
  { column: 'Customer_Name', key: 'customerName', type: sql.NVarChar(50) },
  { column: 'Company_ID', key: 'companyId', type: sql.NVarChar(8), required: true },
  { column: 'Sales_Location_ID', key: 'salesLocationId', type: sql.Decimal(18, 2), required: true, numeric: true },
  { column: 'Customer_PO_Number', key: 'customerPoNumber', type: sql.NVarChar(50) },
  { column: 'Contact_ID', key: 'contactId', type: sql.NVarChar(16) },
  { column: 'Contact_Name', key: 'contactName', type: sql.NVarChar(50) },
  { column: 'Taker', key: 'taker', type: sql.NVarChar(30) },
  { column: 'Job_Name', key: 'jobName', type: sql.NVarChar(40) },
  { column: 'Order_Date', key: 'orderDate', type: sql.NVarChar(8) },
  { column: 'Requested_Date', key: 'requestedDate', type: sql.NVarChar(8) },
  { column: 'Quote', key: 'quote', type: sql.NVarChar(1) },
  { column: 'Approved', key: 'approved', type: sql.NVarChar(1) },
  { column: 'Ship_To_ID', key: 'shipToId', type: sql.Decimal(18, 2), required: true, numeric: true },
  { column: 'Ship_To_Name', key: 'shipToName', type: sql.NVarChar(50) },
  { column: 'Ship_To_Address_1', key: 'shipToAddress1', type: sql.NVarChar(50) },
  { column: 'Ship_To_Address_2', key: 'shipToAddress2', type: sql.NVarChar(50) },
  { column: 'Ship_To_City', key: 'shipToCity', type: sql.NVarChar(50) },
  { column: 'Ship_To_State', key: 'shipToState', type: sql.NVarChar(50) },
  { column: 'Ship_To_Zip_Code', key: 'shipToZipCode', type: sql.NVarChar(10) },
  { column: 'Ship_To_Country', key: 'shipToCountry', type: sql.NVarChar(50) },
  { column: 'Source_Location_ID', key: 'sourceLocationId', type: sql.Decimal(18, 2), numeric: true },
  { column: 'Carrier_ID', key: 'carrierId', type: sql.Decimal(18, 2), numeric: true },
  { column: 'Carrier_Name', key: 'carrierName', type: sql.NVarChar(50) },
  { column: 'Route', key: 'route', type: sql.NVarChar(255) },
  { column: 'Packing_Basis', key: 'packingBasis', type: sql.NVarChar(16) },
  { column: 'Delivery_Instructions', key: 'deliveryInstructions', type: sql.NVarChar(255) },
  { column: 'Terms', key: 'terms', type: sql.NVarChar(2) },
  { column: 'Terms_Desc', key: 'termsDesc', type: sql.NVarChar(20) },
  { column: 'Will_Call', key: 'willCall', type: sql.NVarChar(1) },
  { column: 'Class_1', key: 'class1', type: sql.NVarChar(8) },
  { column: 'Class_2', key: 'class2', type: sql.NVarChar(8) },
  { column: 'Class_3', key: 'class3', type: sql.NVarChar(8) },
  { column: 'Class_4', key: 'class4', type: sql.NVarChar(8) },
  { column: 'Class_5', key: 'class5', type: sql.NVarChar(8) },
  { column: 'RMA_Flag', key: 'rmaFlag', type: sql.NVarChar(1) },
  { column: 'Freight_Code', key: 'freightCode', type: sql.NVarChar(30) },
  { column: 'Third_Party_Billing_Flag_Desc', key: 'thirdPartyBillingFlagDesc', type: sql.NVarChar(40) },
  { column: 'Capture_Usage_Default', key: 'captureUsageDefault', type: sql.NVarChar(1) },
  { column: 'Allocate', key: 'allocate', type: sql.NVarChar(1) },
  { column: 'Contract_Number', key: 'contractNumber', type: sql.NVarChar(255) },
  { column: 'Invoice_Batch_Number', key: 'invoiceBatchNumber', type: sql.NVarChar(255) },
  { column: 'Ship_To_Email_Address', key: 'shipToEmailAddress', type: sql.NVarChar(255) },
  { column: 'Set_Invoice_Exchange_Rate_Source_Desc', key: 'setInvoiceExchangeRateSourceDesc', type: sql.NVarChar(40) },
  { column: 'Ship_To_Phone', key: 'shipToPhone', type: sql.NVarChar(20) },
  { column: 'Currency_ID', key: 'currencyId', type: sql.NVarChar(255) },
  { column: 'Apply_Builder_Allowance_Flag', key: 'applyBuilderAllowanceFlag', type: sql.NVarChar(1) },
  { column: 'Quote_Expiration_Date', key: 'quoteExpirationDate', type: sql.NVarChar(8) },
  { column: 'Promise_Date', key: 'promiseDate', type: sql.NVarChar(8) }
];

const lineFields = [
  { column: 'Import_Set_Number', key: 'importSetNo', type: sql.NVarChar(8), derived: true },
  { column: 'Line_No', key: 'lineNo', type: sql.Decimal(18, 2), required: true, numeric: true, derived: true },
  { column: 'Item_ID', key: 'itemId', type: sql.NVarChar(40), required: true },
  { column: 'Unit_Quantity', key: 'unitQuantity', type: sql.Decimal(18, 2), required: true, numeric: true },
  { column: 'Unit_of_Measure', key: 'unitOfMeasure', type: sql.NVarChar(8), required: true },
  { column: 'Unit_Price', key: 'unitPrice', type: sql.NVarChar(255) },
  { column: 'Extended_Description', key: 'extendedDescription', type: sql.NVarChar(255) },
  { column: 'Source_Location_ID', key: 'sourceLocationId', type: sql.Decimal(18, 2), numeric: true },
  { column: 'Ship_Location_ID', key: 'shipLocationId', type: sql.Decimal(18, 2), numeric: true },
  { column: 'Product_Group_ID', key: 'productGroupId', type: sql.NVarChar(8) },
  { column: 'Supplier_ID', key: 'supplierId', type: sql.Decimal(18, 2), numeric: true },
  { column: 'Supplier_Name', key: 'supplierName', type: sql.NVarChar(50) },
  { column: 'Required_Date', key: 'requiredDate', type: sql.NVarChar(8) },
  { column: 'Expedite_Date', key: 'expediteDate', type: sql.NVarChar(8) },
  { column: 'Will_Call', key: 'willCall', type: sql.NVarChar(1) },
  { column: 'Tax_Item', key: 'taxItem', type: sql.NVarChar(1) },
  { column: 'OK_to_Interchange', key: 'okToInterchange', type: sql.NVarChar(1) },
  { column: 'Pricing_Unit', key: 'pricingUnit', type: sql.NVarChar(8) },
  { column: 'Commission_Cost', key: 'commissionCost', type: sql.NVarChar(255) },
  { column: 'Other_Cost', key: 'otherCost', type: sql.NVarChar(255) },
  { column: 'PO_Cost', key: 'poCost', type: sql.NVarChar(255) },
  { column: 'Disposition', key: 'disposition', type: sql.NVarChar(1) },
  { column: 'Scheduled', key: 'scheduled', type: sql.NVarChar(1) },
  { column: 'Manual_Price_Override', key: 'manualPriceOverride', type: sql.NVarChar(1) },
  { column: 'Commission_Cost_Edited', key: 'commissionCostEdited', type: sql.NVarChar(1) },
  { column: 'Other_Cost_Edited', key: 'otherCostEdited', type: sql.NVarChar(1) },
  { column: 'Capture_Usage', key: 'captureUsage', type: sql.NVarChar(1) },
  { column: 'Tag_and_Hold_Class_ID', key: 'tagAndHoldClassId', type: sql.NVarChar(8) },
  { column: 'Contract_Bin_ID', key: 'contractBinId', type: sql.NVarChar(8) },
  { column: 'Contract_No', key: 'contractNo', type: sql.NVarChar(8) },
  { column: 'Allocation_Qty', key: 'allocationQty', type: sql.Decimal(18, 2), numeric: true },
  { column: 'Promise_Date', key: 'promiseDate', type: sql.NVarChar(8) }
];

const headerColumnList = headerFields.map((f) => f.column).join(', ');
const headerParamList = headerFields.map((f) => `@${f.column}`).join(', ');
const lineColumnList = lineFields.map((f) => f.column).join(', ');
const lineParamList = lineFields.map((f) => `@${f.column}`).join(', ');

const isEmpty = (value) => value === undefined || value === null || value === '';

function validateRecord(record, fields, recordName) {
  const missing = fields
    .filter((field) => field.required && !field.derived && isEmpty(record?.[field.key]))
    .map((field) => field.key);

  if (missing.length > 0) {
    const error = `${recordName} missing required field(s): ${missing.join(', ')}`;
    const err = new Error(error);
    err.status = 400;
    throw err;
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

  return value;
}

router.post('/', async (req, res) => {
  try {
    const { orders } = req.body || {};

    let ordersPayload;
    if (Array.isArray(orders) && orders.length > 0) {
      ordersPayload = orders;
    } else if (req.body && req.body.header && Array.isArray(req.body.lines)) {
      ordersPayload = [{ header: req.body.header, lines: req.body.lines }];
    } else {
      const err = new Error('Request body must contain at least one order with header and lines');
      err.status = 400;
      throw err;
    }

    ordersPayload.forEach((order, orderIndex) => {
      if (!order || typeof order !== 'object') {
        const err = new Error(`Order ${orderIndex + 1} must be an object`);
        err.status = 400;
        throw err;
      }

      const { header, lines } = order;

      if (!header || typeof header !== 'object') {
        const err = new Error(`Order ${orderIndex + 1} is missing a header object`);
        err.status = 400;
        throw err;
      }

      validateRecord(header, headerFields, `Order ${orderIndex + 1} header`);

      if (!Array.isArray(lines) || lines.length === 0) {
        const err = new Error(`Order ${orderIndex + 1} must contain at least one line item`);
        err.status = 400;
        throw err;
      }

      if (isEmpty(header.contractNumber)) {
        const missingUnitPriceLines = [];

        lines.forEach((line, lineIndex) => {
          if (isEmpty(line?.unitPrice)) {
            missingUnitPriceLines.push(lineIndex + 1);
          }
        });

        if (missingUnitPriceLines.length > 0) {
          const missingLineList = missingUnitPriceLines.join(', ');
          const err = new Error(
            `Order ${orderIndex + 1} must include a contractNumber or unitPrice on all lines. Missing unitPrice on line(s): ${missingLineList}`
          );
          err.status = 400;
          throw err;
        }
      }

      lines.forEach((line, lineIndex) => {
        validateRecord(line, lineFields, `Order ${orderIndex + 1} line ${lineIndex + 1}`);
      });
    });

    const pool = await sql.connect(config);
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const lastImportSetNoRequest = new sql.Request(transaction);
      const lastResult = await lastImportSetNoRequest.query(`
        SELECT ISNULL(MAX(CAST(Import_Set_No AS INT)), 0) AS lastImportSetNo
        FROM TMP_OE_Header WITH (UPDLOCK, HOLDLOCK);
      `);

      let nextImportSetNo = Number(lastResult.recordset?.[0]?.lastImportSetNo) || 0;

      const responseOrders = [];

      for (const order of ordersPayload) {
        const currentImportSetNo = String(++nextImportSetNo);
        const headerValues = { ...order.header, importSetNo: currentImportSetNo };
        if (isEmpty(headerValues.approved)) {
          headerValues.approved = 'N';
        }
        if (isEmpty(headerValues.taker)) {
          headerValues.taker = 'API';
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
          INSERT INTO TMP_OE_Header (${headerColumnList})
          VALUES (${headerParamList});
        `);

        let linesInserted = 0;
        for (const [index, originalLine] of order.lines.entries()) {
          const line = {
            ...originalLine,
            importSetNo: currentImportSetNo,
            lineNo: index + 1
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
            INSERT INTO TMP_OE_Line (${lineColumnList})
            VALUES (${lineParamList});
          `);
          linesInserted += 1;
        }

        responseOrders.push({
          importSetNo: currentImportSetNo,
          linesInserted
        });
      }

      await transaction.commit();

      res.status(201).json({
        message: 'Sales orders Accepted',
        orders: responseOrders
      });
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Failed to rollback transaction', rollbackErr);
      }
      throw err;
    }
  } catch (err) {
    console.error('Failed to store sales order(s)', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal Server Error' });
  }
});

router.get('/:order_id', async (req, res) => {
  const rawId = req.params.order_id;
  try {
    await sql.connect(config);

    const headerRequest = new sql.Request();
    headerRequest.input('orderId', sql.VarChar, rawId);
    const headerQuery = `
      SELECT order_no, customer_id, order_date, ship2_name, ship2_add1, po_no,
             job_price_hdr_uid, delete_flag, completed, company_id, date_created,
             po_no_append, location_id, carrier_id, address_id, taker, job_name,
             approved, cancel_flag, promise_date, ups_code, expedite_date,
             oe_hdr.validation_status,
             CASE
               WHEN cancel_flag = 'Y' THEN 'Canceled'
               WHEN delete_flag = 'Y' THEN 'Deleted'
               WHEN completed = 'Y' AND approved = 'Y' THEN 'Completed'
               WHEN approved = 'N' THEN 'Unapproved'
               ELSE 'Open'
             END AS status
      FROM oe_hdr
      WHERE order_no = TRY_CAST(@orderId AS INT)
         OR job_name = @orderId`;

    const headerResult = await headerRequest.query(headerQuery);

    if (headerResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderNumberForLines = headerResult.recordset[0]?.order_no;

    if (!orderNumberForLines) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const lineRequest = new sql.Request();
    lineRequest.input('orderId', sql.Int, orderNumberForLines);
    const lineResult = await lineRequest.query(`
      SELECT order_no, qty_ordered, delete_flag, line_no, complete, disposition,
             qty_allocated, qty_on_pick_tickets, qty_invoiced, required_date,
             unit_size, unit_quantity, customer_part_number, cancel_flag,
             qty_canceled,
             CASE
               WHEN qty_invoiced >= qty_ordered THEN 'Fulfilled'
               WHEN qty_invoiced > 0 AND qty_invoiced < qty_ordered THEN 'Partially Fulfilled'
               WHEN cancel_flag = 'Y' THEN 'Canceled'
               WHEN delete_flag = 'Y' THEN 'Deleted'
               WHEN qty_allocated > 0 THEN 'In Progress'
               WHEN qty_ordered > 0 AND ISNULL(qty_allocated, 0) = 0 AND ISNULL(qty_invoiced, 0) = 0 AND ISNULL(qty_canceled, 0) = 0 THEN 'New'
               ELSE 'Unknown'
             END AS status
      FROM oe_line
      WHERE order_no = @orderId
    `);

    const headerData = headerResult.recordset[0];
    const { job_name, ...rest } = headerData;
    const header = { ...rest, order_ref: job_name };
    const lines = lineResult.recordset;

    res.json({
      header,
      lines
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
