const express = require('express');
const router = express.Router();
const { sql, config } = require('../db');
const { generateFiles } = require('../utils/csvGenerator');
const path = require('path');
const fs = require('fs');

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
  const id = req.params.order_id;
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input('id', sql.VarChar, id);
    const result = await request.query(`
      SELECT TOP (1) * FROM order_log WHERE srx_order_id = @id OR order_id = @id ORDER BY created_at DESC;
    `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /orders/status/:id
router.get('/status/:id', async (req, res) => {
  const rawId = req.params.id.trim();
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input('id', sql.VarChar, rawId);
    const headerResult = await request.query(`
      SELECT order_no, customer_id, order_date, ship2_name, ship2_add1, po_no,
             job_price_hdr_uid, delete_flag, completed, company_id, date_created,
             po_no_append, location_id, carrier_id, address_id, taker, job_name,
             approved, cancel_flag, promise_date, ups_code, expedite_date,
             oe_hdr.validation_status
      FROM oe_hdr
      WHERE order_no = @id OR job_name = @id;
    `);
    if (headerResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const header = headerResult.recordset[0];

    let status = 'Open';
    if (header.cancel_flag === 'Y') {
      status = 'Canceled';
    } else if (header.delete_flag === 'Y') {
      status = 'Deleted';
    } else if (header.completed === 'Y' && header.approved === 'Y') {
      status = 'Completed';
    } else if (header.approved === 'N') {
      status = 'Unapproved';
    }
    header.status = status;

    const orderNo = header.order_no;
    request.input('order_no', sql.Int, orderNo);
    const lineResult = await request.query(`
      SELECT order_no, qty_ordered, delete_flag, line_no, complete, disposition,
             qty_allocated, qty_on_pick_tickets, qty_invoiced, required_date,
             unit_size, unit_quantity, customer_part_number, cancel_flag,
             qty_canceled
      FROM oe_line
      WHERE order_no = @order_no;
    `);

    const lines = lineResult.recordset.map((line) => {
      let lineStatus = 'New';
      const ordered = Number(line.qty_ordered) || 0;
      const allocated = Number(line.qty_allocated) || 0;
      const invoiced = Number(line.qty_invoiced) || 0;
      const canceled = Number(line.qty_canceled) || 0;

      if (line.cancel_flag === 'Y') {
        lineStatus = 'Canceled';
      } else if (line.delete_flag === 'Y') {
        lineStatus = 'Deleted';
      } else if (invoiced === ordered && ordered > 0) {
        lineStatus = 'Fulfilled';
      } else if (invoiced > 0 && invoiced < ordered) {
        lineStatus = 'Partially Fulfilled';
      } else if (allocated > 0) {
        lineStatus = 'In Progress';
      } else if (ordered > 0 && allocated === 0 && invoiced === 0 && canceled === 0) {
        lineStatus = 'New';
      }

      return { ...line, status: lineStatus };
    });

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
