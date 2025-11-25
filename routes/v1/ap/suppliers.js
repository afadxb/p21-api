const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');
// const { apiKeyAuth } = require('../../../middleware/apiKeyAuth');
// router.use(apiKeyAuth('/v1/sales/order'));

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

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

const formatSupplierRecord = (row) => {
  const companyToken = row.company_id ? String(row.company_id).trim() : null;
  const supplierId = row.supplierId ? String(row.supplierId).trim() : null;
  const addressParts = [row.address1, row.address2].filter((part) => part && part.trim());
  const latestModified = [row.date_last_modified, row.terms_date_last_modified]
    .map(normalizeDate)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  const ledgerDimension = companyToken && row.ap_account_no
    ? `${row.ap_account_no}`
    : null;
  const taxDimension = companyToken && row.default_purch_acct_no
    ? `${row.default_purch_acct_no}`
    : null;

  return {
    erpSourceId: process.env.ERP_SOURCE_ID || 'P21',
    externalSystemId: {supplierId} || null,
    isActive: row.delete_flag !== 'Y',
    companyId: companyToken,
    currencyCode: row.currency_code || null,
    name: row.name || null,
    paymentTerm: row.terms_id || null,
    supplierId,
    ledgerDimension1: ledgerDimension,
    taxDimension1: taxDimension,
    clearance1Dimension1: ledgerDimension,
    taxIndicator1: null,
    taxIndicator2: null,
    streetAddress: addressParts.join(' ').trim() || null,
    city: row.city || null,
    zip: row.postalcode || null,
    country: row.country || null,
    telephone: row.phone || null,
    fax: row.fax || null,
    homepage: null,
    emailAddress: row.email_address || null,
    state: row.state || null,
    isProcurable: row.delete_flag !== 'Y',
    prepayment: row.prepayment === 'Y',
    updatedAt: latestModified ? latestModified.toISOString() : null,
    terms: {
      id: row.terms_id || null,
      description: row.terms_desc || null,
      discountPercent: row.discount_pct,
      discountDays: row.discount_days,
      netDays: row.net_days
    }
  };
};

router.get('/', async (req, res) => {
  const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
  const requestedLimit = req.query.limit ?? req.query.page_size ?? req.query.pageSize;
  let limit = parsePositiveInt(requestedLimit, DEFAULT_LIMIT);
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  const offset = (page - 1) * limit;

  const updatedSinceParam = req.query.updated_since;
  const companyParam = typeof req.query.company === 'string' ? req.query.company.trim() : null;

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
      filters.push('(vendor.date_last_modified >= @updatedSince OR terms.date_last_modified >= @updatedSince)');
    }
    if (companyParam) {
      filters.push('vendor.company_id = @company');
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const dataRequest = new sql.Request();
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, limit);
    if (updatedSinceDate) {
      dataRequest.input('updatedSince', sql.DateTime2, updatedSinceDate);
    }
    if (companyParam) {
      dataRequest.input('company', sql.VarChar, companyParam);
    }

    const dataQuery = `
      SELECT
        vendor.vendor_id AS supplierId,
        vendor.company_id,
        vendor.ap_account_no,
        vendor.date_last_modified,
        'Y' AS prepayment,
        vendor.currency_id,
        CASE vendor.currency_id
          WHEN 1 THEN 'CAD'
          WHEN 3 THEN 'USD'
          WHEN 4 THEN 'EUR'
          WHEN 6 THEN 'CNY'
          ELSE 'UNKNOWN'
        END AS currency_code,
        vendor.vendor_name AS name,
        address.mail_address1 AS address1,
        address.mail_address2 AS address2,
        address.mail_city AS city,
        address.mail_state AS state,
        address.mail_postal_code AS postalcode,
        address.mail_country AS country,
        address.central_phone_number AS phone,
        address.central_fax_number AS fax,
        address.email_address,
        vendor.default_purch_acct_no,
        address.delete_flag,
        terms.terms_id,
        terms.terms_desc,
        terms.discount_pct,
        terms.discount_days,
        terms.net_days,
        terms.date_last_modified AS terms_date_last_modified
      FROM vendor
      INNER JOIN address ON vendor.vendor_id = address.id
      INNER JOIN terms ON vendor.default_terms_id = terms.terms_id
      ${whereClause}
      ORDER BY vendor.vendor_id
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await dataRequest.query(dataQuery);

    const countRequest = new sql.Request();
    if (updatedSinceDate) {
      countRequest.input('updatedSince', sql.DateTime2, updatedSinceDate);
    }
    if (companyParam) {
      countRequest.input('company', sql.VarChar, companyParam);
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM vendor
      INNER JOIN address ON vendor.vendor_id = address.id
      INNER JOIN terms ON vendor.default_terms_id = terms.terms_id
      ${whereClause};
    `;

    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0] ? countResult.recordset[0].total : 0;

    const suppliers = result.recordset.map(formatSupplierRecord);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    const lastPage = totalPages === 0 ? page === 1 : page >= totalPages;

    res.json({
      data: suppliers,
      page,
      limit,
      total,
      totalPages,
      lastPage
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to load suppliers' });
  }
});

module.exports = router;
