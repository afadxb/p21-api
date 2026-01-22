const express = require('express');
const router = express.Router();
const { sql, config } = require('../db');
const { generateOrderFilesStrict } = require('../utils/csvGenerator');
const path = require('path');

// POST /orders
// Store the order payload for later processing
router.post('/', async (req, res) => {
  const {
    customer_id,
    company_id,
    sales_location_id,
    taker,
    order_ref,
    approved,
    ship_to_id,
    contract_number,
    lines
  } = req.body;

  if (
    !customer_id ||
    !company_id ||
    !sales_location_id ||
    !taker ||
    !order_ref ||
    !approved ||
    !ship_to_id ||
    !contract_number ||
    !Array.isArray(lines) ||
    lines.length === 0
  ) {
    return res.status(400).json({ error: 'Invalid order payload' });
  }

  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input('payload', sql.NVarChar(sql.MAX), JSON.stringify(req.body));
    const result = await request.query(`
      INSERT INTO orders_received (payload)
      OUTPUT INSERTED.id AS id
      VALUES (@payload);
    `);
    const insertedId = result.recordset[0].id;

    res.json({
      message: 'Order received',
      id: insertedId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /orders/export/:recordId
// Generate CSV files from a stored order
router.post('/export/:recordId', async (req, res) => {
  const recordId = parseInt(req.params.recordId, 10);
  if (isNaN(recordId)) {
    return res.status(400).json({ error: 'Invalid record id' });
  }

  try {
    await sql.connect(config);
    const fetchReq = new sql.Request();
    fetchReq.input('id', sql.Int, recordId);
    const fetchResult = await fetchReq.query(`
      SELECT payload, processed FROM orders_received WHERE id = @id;
    `);

    if (fetchResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = JSON.parse(fetchResult.recordset[0].payload);

    const {
      customer_id,
      company_id,
      sales_location_id,
      taker,
      order_ref,
      approved,
      ship_to_id,
      contract_number,
      notes,
      lines
    } = order;

    const exportDir = path.join(
      __dirname,
      '..',
      'exports',
      `order-${order_ref}-${Date.now()}`
    );

    const headerRecord = {
      'Order No': order_ref,
      'Customer ID': customer_id,
      'Company ID': company_id,
      'Sales Rep': taker,
      'Completed': approved,
      'Ship To Name': ship_to_id,
      'Job Price Header UID': contract_number
    };
    if (notes) {
      headerRecord['Notes'] = notes;
    }

    const lineRecords = lines.map((l, idx) => ({
      'Line No': idx + 1,
      'Item ID': l.item_id,
      'Unit Quantity': l.qty,
      'Ship Location ID': sales_location_id,
      'Contract No.': contract_number
    }));

    const csvInfo = generateOrderFilesStrict(headerRecord, lineRecords, exportDir);

    const logReq = new sql.Request();
    logReq.input('order_ref', sql.VarChar, order_ref);
    logReq.input('order_id', sql.VarChar, String(csvInfo.orderId));
    logReq.input('status', sql.VarChar, 'exported');
    logReq.input('export_path', sql.VarChar, exportDir);
    await logReq.query(`
      INSERT INTO order_log (order_ref, order_id, status, export_path, created_at)
      VALUES (@order_ref, @order_id, @status, @export_path, GETDATE());
    `);

    const updateReq = new sql.Request();
    updateReq.input('id', sql.Int, recordId);
    await updateReq.query('UPDATE orders_received SET processed = 1 WHERE id = @id');

    res.json({
      message: 'Order exported',
      files: {
        headerFile: path.relative(process.cwd(), csvInfo.headerFile),
        linesFile: path.relative(process.cwd(), csvInfo.linesFile)
      },
      importSetNumber: csvInfo.importSetNumber
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /orders/:order_id
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
      SELECT oe_line.order_no, oe_line.qty_ordered, oe_line.delete_flag, oe_line.line_no,
             oe_line.complete, oe_line.disposition, oe_line.qty_allocated,
             oe_line.qty_on_pick_tickets, oe_line.qty_invoiced, oe_line.required_date,
             oe_line.unit_size, oe_line.unit_quantity, oe_line.customer_part_number,
             oe_line.cancel_flag, oe_line.qty_canceled,
             CASE
               WHEN qty_invoiced >= qty_ordered THEN 'Fulfilled'
               WHEN qty_invoiced > 0 AND qty_invoiced < qty_ordered THEN 'Partially Fulfilled'
               WHEN cancel_flag = 'Y' THEN 'Canceled'
               WHEN delete_flag = 'Y' THEN 'Deleted'
               WHEN qty_allocated > 0 THEN 'In Progress'
               WHEN qty_ordered > 0 AND ISNULL(qty_allocated, 0) = 0
                 AND ISNULL(qty_invoiced, 0) = 0 AND ISNULL(qty_canceled, 0) = 0 THEN 'New'
               ELSE 'Unknown'
             END AS status,
             inv_mast.item_id
      FROM oe_line
      INNER JOIN inv_mast ON oe_line.inv_mast_uid = inv_mast.inv_mast_uid
      WHERE oe_line.order_no = @orderId
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
