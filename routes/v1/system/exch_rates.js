const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');
const logger = require('../../../utils/logger');
const asyncHandler = require('../../../utils/asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
    await sql.connect(config);

    const query = `
      SELECT 
          CASE from_currency_id
              WHEN 1 THEN 'CAD'
              WHEN 3 THEN 'USD'
              WHEN 4 THEN 'EUR'
          END AS from_currency,
          CASE to_currency_id
              WHEN 1 THEN 'CAD'
              WHEN 3 THEN 'USD'
              WHEN 4 THEN 'EUR'
          END AS to_currency,
          CAST(exchange_rate AS DECIMAL(10,4)) AS exchange_rate,
          CAST(ROUND(1 / exchange_rate, 4) AS DECIMAL(10,4)) AS reverse_exchange_rate,
          exchange_date
      FROM exchange_rate_current;
    `;

    const result = await sql.query(query);
    res.json(result.recordset);
}));

module.exports = router;
