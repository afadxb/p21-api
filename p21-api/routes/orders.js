const express = require('express');
const router = express.Router();
const { sql, config } = require('../db');
const { generateFiles } = require('../utils/csvGenerator');
const path = require('path');

// POST /orders
router.post('/', async (req, res) => {
  const { customer_id, sales_location_id, srx_order_id, notes, lines } = req.body;
  if (!customer_id || !sales_location_id || !srx_order_id || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'Invalid order payload' });
  }

  try {
    const csvInfo = generateFiles({ customer_id, sales_location_id, srx_order_id, notes, lines });

    await sql.connect(config);
    const request = new sql.Request();
    request.input('srx_order_id', sql.VarChar, srx_order_id);
    request.input('status', sql.VarChar, 'exported');
    request.input('export_path', sql.VarChar, csvInfo.exportDir);
    await request.query(`
      INSERT INTO order_log (srx_order_id, status, export_path, created_at)
      VALUES (@srx_order_id, @status, @export_path, GETDATE());
    `);

    res.json({
      message: 'Order exported',
      files: {
        header: path.relative(process.cwd(), csvInfo.headerPath),
        line: path.relative(process.cwd(), csvInfo.linePath),
        headerNotes: csvInfo.headerNotesPath ? path.relative(process.cwd(), csvInfo.headerNotesPath) : null,
        lineNotes: csvInfo.lineNotesPath ? path.relative(process.cwd(), csvInfo.lineNotesPath) : null
      }
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
