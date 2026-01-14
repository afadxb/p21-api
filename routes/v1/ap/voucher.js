const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');

const parseOptionalInt = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
};

const parsePositiveInt = (value, defaultValue) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  return parsed;
};

const mapCurrencyIdToCode = (currencyId) => {
  switch (currencyId) {
    case 1:
      return 'CAD';
    case 3:
      return 'USD';
    case 4:
      return 'EUR';
    case 6:
      return 'CNY';
    default:
      return currencyId ? String(currencyId).trim() : null;
  }
};

const toIsoString = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const DEFAULT_MIN_DATE_CREATED = new Date('2020-01-01T00:00:00Z');

const formatVoucherHeader = (row) => ({
  voucherNumber: row.voucher_no ? String(row.voucher_no).trim() : null,
  vendorId: row.vendor_id ? String(row.vendor_id).trim() : null,
  companyId: row.company_no ? String(row.company_no).trim() : null,
  branchId: row.branch_id ? String(row.branch_id).trim() : null,
  locationId: row.location_id ? String(row.location_id).trim() : null,
  poType: row.po_type ? String(row.po_type).trim() : null,
  poNumber: row.po_no ? String(row.po_no).trim() : null,
  invoiceNumber: row.invoice_no ? String(row.invoice_no).trim() : null,
  invoiceDate: toIsoString(row.invoice_date),
  homeCurrencyAmount: row.home_currency_amt != null ? Number(row.home_currency_amt) : null,
  invoiceAmount: row.invoice_amount != null ? Number(row.invoice_amount) : null,
  currencyId: mapCurrencyIdToCode(row.currency_id),
  exchangeRate: row.exchange_rate != null ? Number(row.exchange_rate) : null,
  period: row.period != null ? Number(row.period) : null,
  yearForPeriod: row.year_for_period != null ? Number(row.year_for_period) : null,
  disputed: row.disputed_flag === 'Y',
  freightAmount: row.freight_amount != null ? Number(row.freight_amount) : null,
  termsAmountTaken: row.terms_amount_taken != null ? Number(row.terms_amount_taken) : null,
  amountPaid: row.amount_paid != null ? Number(row.amount_paid) : null,
  totalAmountPaid: row.total_amount_paid != null ? Number(row.total_amount_paid) : null,
  paidInFull: row.paid_in_full === 'Y',
  approved: row.approved === 'Y',
  canceled: row.canceled === 'Y',
  dateCreated: toIsoString(row.date_created),
  dateLastModified: toIsoString(row.date_last_modified),
});

const formatVoucherDetail = (row) => ({
  detailType: row.detail_type ? String(row.detail_type).trim() : null,
  itemId: row.item_id ? String(row.item_id).trim() : null,
  description: row.description ? String(row.description).trim() : null,
  quantity: row.quantity != null ? Number(row.quantity) : null,
  unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
  purchaseAmount: row.purchase_amount != null ? Number(row.purchase_amount) : null,
  disputed: row.disputed_flag === 'Y',
  disputedAmount: row.disputed_amt != null ? Number(row.disputed_amt) : null,
  lineFreightAmount: row.line_freight_amount != null ? Number(row.line_freight_amount) : null,
  lineFreightAmountDisplay: row.line_freight_amount_display != null
    ? Number(row.line_freight_amount_display)
    : null
});

router.get('/', async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1);
  const requestedLimit = req.query.limit ?? req.query.page_size ?? req.query.pageSize;
  let limit = parsePositiveInt(requestedLimit, 500);
  if (limit > 2000) {
    limit = 2000;
  }
  const offset = (page - 1) * limit;

  const voucherParam = parseOptionalInt(req.query.voucher ?? req.query.voucherNo ?? req.query.voucher_no);
  const vendorParam = parseOptionalInt(req.query.vendor ?? req.query.vendorId ?? req.query.vendor_id);

  if (voucherParam === undefined || vendorParam === undefined) {
    return res.status(400).json({
      error: 'voucher/voucherNo and vendor/vendorId must be integers when provided.'
    });
  }

  try {
    await sql.connect(config);

    const filters = ['h.date_created >= @min_date_created'];
    const parameters = [
      { name: 'min_date_created', type: sql.DateTime2, value: DEFAULT_MIN_DATE_CREATED }
    ];
    
    if (voucherParam !== null) {
      filters.push('h.voucher_no = @voucher');
      parameters.push({ name: 'voucher', type: sql.Int, value: voucherParam });
    }
    if (vendorParam !== null) {
      filters.push('h.vendor_id = @vendor');
      parameters.push({ name: 'vendor', type: sql.Int, value: vendorParam });
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const headerRequest = new sql.Request();
    headerRequest.input('offset', sql.Int, offset);
    headerRequest.input('limit', sql.Int, limit);
    parameters.forEach((param) => {
      headerRequest.input(param.name, param.type, param.value);
    });

    const headerQuery = `
      WITH filtered_headers AS (
          SELECT
              h.voucher_no,
              h.vendor_id,
              h.company_no,
              h.branch_id,
              loc.location_id,
              CASE WHEN h.po_no IS NULL THEN 'Non-PO' ELSE 'PO' END AS po_type,
              h.po_no,
              h.invoice_no,
              h.invoice_date,
              h.home_currency_amt,
              h.invoice_amount,
              h.currency_id,
              h.exchange_rate,
              h.period,
              h.year_for_period,
              h.disputed_flag,
              h.freight_amount,
              h.terms_amount_taken,
              h.amount_paid,
              (h.amount_paid
               + h.terms_amount_taken
               + h.iva_withheld_amount
               + h.iva_terms_amount_taken) AS total_amount_paid,
              h.paid_in_full,
              h.approved,
              h.reverse_flag AS canceled,
              h.date_created,
              h.date_last_modified,
              ROW_NUMBER() OVER (ORDER BY h.voucher_no) AS rn
          FROM apinv_hdr h
          OUTER APPLY (
              SELECT TOP (1) l.location_id
              FROM location l
              WHERE l.company_id = h.company_no
                AND l.default_branch_id = h.branch_id
              ORDER BY l.location_id
          ) loc
          ${whereClause}
      )
      SELECT *
      FROM filtered_headers
      WHERE rn BETWEEN @offset + 1 AND @offset + @limit
      ORDER BY rn;
    `;

    const detailRequest = new sql.Request();
    detailRequest.input('offset', sql.Int, offset);
    detailRequest.input('limit', sql.Int, limit);
    parameters.forEach((param) => {
      detailRequest.input(param.name, param.type, param.value);
    });

    const detailQuery = `
      WITH filtered_headers AS (
          SELECT
              h.voucher_no,
              h.vendor_id,
              ROW_NUMBER() OVER (ORDER BY h.voucher_no) AS rn
          FROM apinv_hdr h
          ${whereClause}
      ),
      hdr AS (
          SELECT h.*
          FROM apinv_hdr h
          JOIN filtered_headers fh
            ON fh.voucher_no = h.voucher_no
           AND fh.vendor_id = h.vendor_id
          WHERE fh.rn BETWEEN @offset + 1 AND @offset + @limit
      )
      SELECT
          h.voucher_no,
          h.vendor_id,
          'LINE' AS detail_type,
          l.item_id,
          l.description,
          l.quantity,
          l.unit_price,
          l.purchase_amount,
          l.company_no,
          l.disputed_flag,
          l.disputed_amt,
          l.freight_amount AS line_freight_amount,
          l.freight_amount_display AS line_freight_amount_display,
          l.date_created,
          l.date_last_modified,
          l.last_maintained_by
      FROM hdr h
      JOIN apinv_line l
          ON h.voucher_no = l.voucher_no
      JOIN chart_of_accts c
          ON c.account_no = l.purchase_account
         AND c.company_no = l.company_no

      UNION ALL
      SELECT
          h.voucher_no,
          h.vendor_id,
          'CHARGE' AS detail_type,
          vpa.purchase_desc AS item_id,
          CAST(h.invoice_no AS VARCHAR(30)) AS description,
          1 AS quantity,
          vpa.purchase_amt AS unit_price,
          vpa.purchase_amt AS purchase_amount,
          vpa.company_id AS company_no,
          vpa.disputed_flag,
          CASE
              WHEN vpa.disputed_flag = 'Y' THEN vpa.purchase_amt
              ELSE 0.00
          END AS disputed_amt,
          0.0000 AS line_freight_amount,
          0.0000 AS line_freight_amount_display,
          vpa.date_created,
          vpa.date_last_modified,
          vpa.last_maintained_by
      FROM hdr h
      JOIN voucher_purchase_acct vpa
          ON h.voucher_no = vpa.voucher_no
      JOIN chart_of_accts c
          ON c.account_no = vpa.purchase_acct_no
         AND c.company_no = vpa.company_id

      UNION ALL
      SELECT
          h.voucher_no,
          h.vendor_id,
          'VAT' AS detail_type,
          vc.vat_cd AS item_id,
          vc.description,
          1 AS quantity,
          hv.tax_amt AS unit_price,
          hv.tax_amt AS purchase_amount,
          h.company_no,
          COALESCE(hv.disputed_flag, 'N') AS disputed_flag,
          CASE
              WHEN COALESCE(hv.disputed_flag, 'N') = 'Y'
                  THEN hv.tax_amt
              ELSE 0.00
          END AS disputed_amt,
          0.0000 AS line_freight_amount,
          0.0000 AS line_freight_amount_display,
          hv.date_created,
          hv.date_last_modified,
          hv.last_maintained_by
      FROM hdr h
      JOIN apinv_hdr_vat hv
          ON hv.voucher_no = h.voucher_no
      JOIN vat_code vc
          ON vc.vat_code_uid = hv.vat_code_uid
      JOIN chart_of_accts c
          ON c.chart_of_accts_uid = vc.chart_of_accts_uid
      ORDER BY detail_type, item_id;
    `;

    const countRequest = new sql.Request();
    parameters.forEach((param) => {
      countRequest.input(param.name, param.type, param.value);
    });

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM apinv_hdr h
      ${whereClause};
    `;

    const [headerResult, detailResult, countResult] = await Promise.all([
      headerRequest.query(headerQuery),
      detailRequest.query(detailQuery),
      countRequest.query(countQuery)
    ]);

    const headers = headerResult.recordset || [];
    const details = detailResult.recordset || [];

    const detailMap = new Map();
    details.forEach((row) => {
      const voucherKey = row.voucher_no
        ? `${String(row.voucher_no).trim()};${row.vendor_id ? String(row.vendor_id).trim() : ''}`
        : `__unknown_${detailMap.size}`;
      if (!detailMap.has(voucherKey)) {
        detailMap.set(voucherKey, []);
      }
      detailMap.get(voucherKey).push(formatVoucherDetail(row));
    });

    const data = headers.map((row) => {
      const formattedHeader = formatVoucherHeader(row);
      const detailKey = formattedHeader.voucherNumber
        ? `${formattedHeader.voucherNumber};${formattedHeader.vendorId ?? ''}`
        : `__unknown_${detailMap.size}`;
      return {
        header: formattedHeader,
        lines: detailMap.get(detailKey) || []
      };
    });

    const total = countResult.recordset[0] ? countResult.recordset[0].total : 0;
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    const lastPage = totalPages === 0 ? page === 1 : page >= totalPages;

    return res.json({
      data,
      page,
      pageSize: limit,
      total,
      totalPages,
      lastPage
    });
  } catch (error) {
    console.error('Failed to fetch voucher', error);
    return res.status(500).json({ error: 'Failed to fetch voucher' });
  }
});

module.exports = router;
