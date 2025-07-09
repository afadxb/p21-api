const express = require('express');
const router = express.Router();
const { sql, config } = require('../db');

// POST /salesorders
router.post('/', (req, res) => {
  res.json({ message: 'Sales order created (placeholder)' });
});

// GET /salesorders/:order_id
router.get('/:order_id', async (req, res) => {
  const rawId = req.params.order_id;
  const orderId = parseInt(rawId, 10);

  if (Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order_id' });
  }

  try {
    await sql.connect(config);

    const headerRequest = new sql.Request();
    headerRequest.input('orderId', sql.Int, orderId);
    const headerResult = await headerRequest.query(`
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
      WHERE order_no = @orderId
    `);

    if (headerResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const lineRequest = new sql.Request();
    lineRequest.input('orderId', sql.Int, orderId);
    const lineResult = await lineRequest.query(`
      SELECT order_no, qty_ordered, delete_flag, line_no, complete, disposition,
             qty_allocated, qty_on_pick_tickets, qty_invoiced, required_date,
             unit_size, unit_quantity, customer_part_number, cancel_flag,
             qty_canceled,
             CASE
               WHEN qty_invoiced = qty_ordered THEN 'Fulfilled'
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

    const header = headerResult.recordset[0];
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
