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

module.exports = router;
