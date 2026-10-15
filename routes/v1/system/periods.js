const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');
const logger = require('../../../utils/logger');
const asyncHandler = require('../../../utils/asyncHandler');

const getYearsFromRequest = (req) => {
  if (!req.params.year) {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear + 1];
  }

  const parsedYear = Number.parseInt(req.params.year, 10);

  if (Number.isNaN(parsedYear) || `${parsedYear}` !== req.params.year) {
    return null;
  }

  return [parsedYear];
};

router.get('/:year?', asyncHandler(async (req, res) => {
    const years = getYearsFromRequest(req);

    if (years === null) {
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
      FROM periods
      WHERE year_for_period IN (@year1, @year2)
      ORDER BY company_no, year_for_period, period;
    `;

    const request = new sql.Request();
    request.input('year1', sql.Int, years[0]);
    request.input('year2', sql.Int, years.length > 1 ? years[1] : years[0]);

    const result = await request.query(query);
    res.json(result.recordset);
}));

module.exports = router;
