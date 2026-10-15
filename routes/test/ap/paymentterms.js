const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');
// const { apiKeyAuth } = require('../../../middleware/apiKeyAuth');
// router.use(apiKeyAuth('/v1/sales/order'));

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 2000;

const parsePositiveInt = (value, defaultValue) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  return parsed;
};

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDiscountLine = (row) => ({
  cashDiscountPercentage: row.discount_pct != null ? Number(row.discount_pct) * 100 : 0,
  endOfMonth: Boolean(row.day_of_month),
  numberOfDays: row.discount_days != null ? Number(row.discount_days) : 0,
  numberOfMonths: row.months != null ? Number(row.months) : 0
});

const buildNetLine = (row) => ({
  cashDiscountPercentage: 0,
  endOfMonth: Boolean(row.terms_day_of_month),
  numberOfDays: row.net_days != null ? Number(row.net_days) : 0,
  numberOfMonths: row.terms_months != null ? Number(row.terms_months) : 0
});

router.get('/', async (req, res) => {
  const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
  const requestedPageSize = req.query.limit ?? req.query.page_size ?? req.query.pageSize;
  let pageSize = parsePositiveInt(requestedPageSize, DEFAULT_PAGE_SIZE);
  if (pageSize > MAX_PAGE_SIZE) {
    pageSize = MAX_PAGE_SIZE;
  }

  const offset = (page - 1) * pageSize;
  const startRow = offset + 1;
  const endRow = offset + pageSize;

  const updatedSinceParam = req.query.updated_since;
  const companyIdParam = typeof req.query.companyId === 'string' ? req.query.companyId.trim() : null;

  let updatedSinceDate = null;
  if (updatedSinceParam) {
    updatedSinceDate = new Date(updatedSinceParam);
    if (Number.isNaN(updatedSinceDate.getTime())) {
      return res.status(400).json({ error: 'Invalid updated_since parameter. Expecting ISO 8601 date.' });
    }
  }

  try {
    await sql.connect(config);

    const filters = [];
    if (updatedSinceDate) {
      filters.push('terms.date_last_modified >= @updatedSince');
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const dataRequest = new sql.Request();
    dataRequest.input('startRow', sql.Int, startRow);
    dataRequest.input('endRow', sql.Int, endRow);
    if (updatedSinceDate) {
      dataRequest.input('updatedSince', sql.DateTime2, updatedSinceDate);
    }

    const query = `
      WITH filtered_terms AS (
        SELECT
          terms.terms_id,
          terms.terms_desc,
          terms.discount_pct,
          terms.discount_days,
          terms.net_days,
          terms.day_of_month,
          terms.terms_day_of_month,
          terms.months,
          terms.terms_months,
          terms.date_last_modified
        FROM terms
        ${whereClause}
      ),
      distinct_terms AS (
        SELECT
          terms_id,
          MAX(terms_desc) AS terms_desc,
          MAX(net_days) AS net_days,
          MAX(terms_day_of_month) AS terms_day_of_month,
          MAX(terms_months) AS terms_months,
          MAX(date_last_modified) AS date_last_modified
        FROM filtered_terms
        GROUP BY terms_id
      ),
      paged_terms AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY terms_id) AS row_num
        FROM distinct_terms
      )
      SELECT
        pt.terms_id,
        pt.terms_desc,
        ft.discount_pct,
        ft.discount_days,
        pt.net_days,
        ft.day_of_month,
        pt.terms_day_of_month,
        ft.months,
        pt.terms_months,
        pt.date_last_modified
      FROM paged_terms pt
      LEFT JOIN filtered_terms ft ON ft.terms_id = pt.terms_id
      WHERE pt.row_num BETWEEN @startRow AND @endRow
      ORDER BY pt.terms_id, ft.discount_days;
    `;

    const result = await dataRequest.query(query);

    const countRequest = new sql.Request();
    if (updatedSinceDate) {
      countRequest.input('updatedSince', sql.DateTime2, updatedSinceDate);
    }

    const countQuery = `
      SELECT COUNT(DISTINCT terms.terms_id) AS total
      FROM terms
      ${whereClause};
    `;

    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0] ? countResult.recordset[0].total : 0;

    const grouped = new Map();
    result.recordset.forEach((row) => {
      const key = row.terms_id ? String(row.terms_id).trim() : null;
      if (!key) {
        return;
      }
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(row);
    });

    const erpSourceId = process.env.ERP_SOURCE_ID || 'P21';

    const paymentTerms = Array.from(grouped.entries()).map(([termsId, rows]) => {
      rows.sort((a, b) => {
        const aDays = a.discount_days != null ? Number(a.discount_days) : Number.MAX_SAFE_INTEGER;
        const bDays = b.discount_days != null ? Number(b.discount_days) : Number.MAX_SAFE_INTEGER;
        return aDays - bDays;
      });

      const baseRow = rows[0];
      const lines = [];

      rows.forEach((row) => {
        const discountPct = row.discount_pct != null ? Number(row.discount_pct) : null;
        const hasDiscount = discountPct && discountPct > 0;
        if (hasDiscount) {
          lines.push(buildDiscountLine(row));
        }
      });

      const netLine = buildNetLine(baseRow);
      if (netLine.numberOfDays || netLine.numberOfMonths) {
        lines.push(netLine);
      } else if (!lines.length) {
        lines.push({
          cashDiscountPercentage: 0,
          endOfMonth: false,
          numberOfDays: 0,
          numberOfMonths: 0
        });
      }

      const payload = {
        erpSourceId,
        externalSystemId: companyIdParam ? `${companyIdParam};${termsId}` : termsId,
        isActive: true,
        lines,
        companyId: companyIdParam,
        paymentTermId: termsId,
        name: baseRow.terms_desc || termsId,
        description: baseRow.terms_desc || termsId
      };

      const updatedAt = normalizeDate(baseRow.date_last_modified);
      if (updatedAt) {
        payload.updatedAt = updatedAt.toISOString();
      }

      const startDateMonths = baseRow.terms_months != null ? Number(baseRow.terms_months) : null;
      if (baseRow.terms_day_of_month != null || startDateMonths != null) {
        payload.startDate = {
          type: 'InvoiceDate',
          numberOfMonths: startDateMonths != null ? startDateMonths : 0
        };
      }

      return payload;
    });

    paymentTerms.sort((a, b) => a.paymentTermId.localeCompare(b.paymentTermId));

    const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
    const lastPage = totalPages === 0 ? page === 1 : page >= totalPages;

    res.json({
      data: paymentTerms,
      page,
      pageSize,
      total,
      totalPages,
      lastPage
    });
  } catch (error) {
    console.error('Error fetching payment terms:', error);
    res.status(500).json({ error: 'Failed to load payment terms' });
  }
});

module.exports = router;
