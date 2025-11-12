const express = require('express');
const router = express.Router();
const { sql, config } = require('../db');

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

module.exports = router;
