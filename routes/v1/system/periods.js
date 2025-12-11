const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');

const getYearFromRequest = (req) => {
  if (!req.params.year) {
    return new Date().getFullYear();
  }

  const parsedYear = Number.parseInt(req.params.year, 10);

  if (Number.isNaN(parsedYear) || `${parsedYear}` !== req.params.year) {
    return null;
  }

  return parsedYear;
};

router.get('/:year?', async (req, res) => {
  try {
    const year = getYearFromRequest(req);

    if (year === null) {
      return res.status(400).json({ error: 'Invalid year parameter' });
    }

    await sql.connect(config);

    const query = `
      SELECT
          company_no,
          period,
          year_for_period,
          period_closed,
          date_last_modified,
          beginning_date,
          ending_date,
          adjustment_period_flag
      FROM p21_view_periods
      WHERE year_for_period = @year
      ORDER BY company_no, period;
    `;

    const request = new sql.Request();
    request.input('year', sql.Int, year);

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
