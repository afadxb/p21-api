const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');
// const { apiKeyAuth } = require('../../../middleware/apiKeyAuth');
// router.use(apiKeyAuth('/v1/ap/paymentdetail'));

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

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
      return currencyId != null ? String(currencyId).trim() : null;
  }
};

const parsePositiveInt = (value, defaultValue) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  return parsed;
};

const toIsoString = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatPaymentDetailRow = (row) => ({
  companyNumber: row.company_no ? String(row.company_no).trim() : null,
  vendorId: row.vendor_id ? String(row.vendor_id).trim() : null,
  invoiceNumber: row.invoice_no ? String(row.invoice_no).trim() : null,
  invoiceDate: toIsoString(row.invoice_date),
  invoiceAmount: row.invoice_amount != null ? Number(row.invoice_amount) : null,
  voucherNumber: row.voucher_no ? String(row.voucher_no).trim() : null,
  checkNumber: row.check_no ? String(row.check_no).trim() : null,
  checkDate: toIsoString(row.check_date),
  currency: row.currency ? String(row.currency).trim() : mapCurrencyIdToCode(row.currency_id),
  voucherRefInvoiceNumber: row.voucher_ref_inv_no ? String(row.voucher_ref_inv_no).trim() : null,
  apAccountNumber: row.ap_account_no ? String(row.ap_account_no).trim() : null,
  cashAccountNumber: row.cash_account_no ? String(row.cash_account_no).trim() : null,
  approved: row.approved === 'Y',
  poNumber: row.po_no ? String(row.po_no).trim() : null,
  paidInFull: row.paid_in_full === 'Y',
  amountPaid: row.amount_paid != null ? Number(row.amount_paid) : null,
  homeAmountPaid: row.home_amt_paid != null ? Number(row.home_amt_paid) : null,
  termsAmountTaken: row.terms_amount_taken != null ? Number(row.terms_amount_taken) : null,
  amountPaidDisplay: row.amount_paid_display != null ? Number(row.amount_paid_display) : null
});

const groupPaymentDetails = (rows) => {
  const groupedByVoucher = new Map();

  rows.forEach((row) => {
    const formatted = formatPaymentDetailRow(row);
    const voucherKey = formatted.voucherNumber ?? `__unknown_${groupedByVoucher.size}`;

    if (!groupedByVoucher.has(voucherKey)) {
      groupedByVoucher.set(voucherKey, {
        companyNumber: formatted.companyNumber,
        vendorId: formatted.vendorId,
        invoiceNumber: formatted.invoiceNumber,
        invoiceDate: formatted.invoiceDate,
        invoiceAmount: formatted.invoiceAmount,
        voucherNumber: formatted.voucherNumber,
        checkNumber: formatted.checkNumber,
        checkDate: formatted.checkDate,
        currency: formatted.currency,
        voucherRefInvoiceNumber: formatted.voucherRefInvoiceNumber,
        apAccountNumber: formatted.apAccountNumber,
        cashAccountNumber: formatted.cashAccountNumber,
        approved: formatted.approved,
        poNumber: formatted.poNumber,
        PaymentLine: []
      });
    }

    const hasPaymentDetail =
      formatted.amountPaid != null ||
      formatted.homeAmountPaid != null ||
      formatted.termsAmountTaken != null ||
      formatted.amountPaidDisplay != null ||
      row.paid_in_full != null;

    if (hasPaymentDetail) {
      groupedByVoucher.get(voucherKey).PaymentLine.push({
        paidInFull: formatted.paidInFull,
        amountPaid: formatted.amountPaid,
        homeAmountPaid: formatted.homeAmountPaid,
        termsAmountTaken: formatted.termsAmountTaken,
        amountPaidDisplay: formatted.amountPaidDisplay
      });
    }
  });

  return Array.from(groupedByVoucher.values());
};

router.get('/', async (req, res) => {
  const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
  const requestedLimit = req.query.limit ?? req.query.page_size ?? req.query.pageSize;
  let limit = parsePositiveInt(requestedLimit, DEFAULT_LIMIT);
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }
  const offset = (page - 1) * limit;

  const filters = [];
  const parameters = [];

  const companyParam = typeof req.query.company === 'string' ? req.query.company.trim() : null;
  if (companyParam) {
    filters.push('apinv_hdr.company_no = @company');
    parameters.push({ name: 'company', type: sql.VarChar, value: companyParam });
  }

  const vendorParam = typeof req.query.vendor === 'string' ? req.query.vendor.trim() : null;
  if (vendorParam) {
    filters.push('apinv_hdr.vendor_id = @vendor');
    parameters.push({ name: 'vendor', type: sql.VarChar, value: vendorParam });
  }

  const voucherParam = typeof req.query.voucherNo === 'string' ? req.query.voucherNo.trim() : null;
  if (voucherParam) {
    filters.push('apinv_hdr.voucher_no = @voucherNo');
    parameters.push({ name: 'voucherNo', type: sql.VarChar, value: voucherParam });
  }

  const invoiceParam = typeof req.query.invoiceNo === 'string' ? req.query.invoiceNo.trim() : null;
  if (invoiceParam) {
    filters.push('apinv_hdr.invoice_no = @invoiceNo');
    parameters.push({ name: 'invoiceNo', type: sql.VarChar, value: invoiceParam });
  }

  const poParam = typeof req.query.poNo === 'string' ? req.query.poNo.trim() : null;
  if (poParam) {
    filters.push('apinv_hdr.po_no = @poNo');
    parameters.push({ name: 'poNo', type: sql.VarChar, value: poParam });
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    await sql.connect(config);

    const dataRequest = new sql.Request();
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, limit);
    parameters.forEach((param) => {
      dataRequest.input(param.name, param.type, param.value);
    });

    const query = `
      WITH filtered_headers AS (
        SELECT
          apinv_hdr.company_no,
          apinv_hdr.vendor_id,
          apinv_hdr.invoice_no,
          apinv_hdr.invoice_date,
          apinv_hdr.invoice_amount,
          apinv_hdr.voucher_no,
          apinv_hdr.check_no,
          apinv_hdr.check_date,
          apinv_hdr.currency_id,
          apinv_hdr.voucher_ref_inv_no,
          apinv_hdr.ap_account_no,
          apinv_hdr.cash_account_no,
          apinv_hdr.approved,
          apinv_hdr.po_no,
          apinv_hdr.paid_in_full
        FROM apinv_hdr
        ${whereClause}
      ),
      paged_headers AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY invoice_date DESC, voucher_no) AS rn
        FROM filtered_headers
      )
      SELECT
        ph.company_no,
        ph.vendor_id,
        ph.invoice_no,
        ph.invoice_date,
        ph.invoice_amount,
        ph.voucher_no,
        ph.check_no,
        ph.check_date,
        CASE ph.currency_id
          WHEN 1 THEN 'CAD'
          WHEN 3 THEN 'USD'
          WHEN 4 THEN 'EUR'
          WHEN 6 THEN 'CNY'
          ELSE NULL
        END AS currency,
        ph.voucher_ref_inv_no,
        ph.ap_account_no,
        ph.cash_account_no,
        ph.approved,
        ph.po_no,
        ph.paid_in_full,
        payment_detail.amount_paid,
        payment_detail.home_amt_paid,
        payment_detail.terms_amount_taken,
        payment_detail.amount_paid_display
      FROM paged_headers ph
      LEFT JOIN payment_detail ON ph.voucher_no = payment_detail.voucher_no
      WHERE ph.rn BETWEEN @offset + 1 AND @offset + @limit
      ORDER BY ph.invoice_date DESC, ph.voucher_no, ph.rn;
    `;

  const dataResult = await dataRequest.query(query);

  const countRequest = new sql.Request();
    parameters.forEach((param) => {
    countRequest.input(param.name, param.type, param.value);
  });

    const countQuery = `
      WITH filtered_headers AS (
        SELECT apinv_hdr.voucher_no
        FROM apinv_hdr
        ${whereClause}
      )
      SELECT COUNT(*) AS total FROM filtered_headers;
    `;

  const countResult = await countRequest.query(countQuery);
  const total = countResult.recordset[0] ? Number(countResult.recordset[0].total) : 0;

  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  const lastPage = totalPages === 0 ? page === 1 : page >= totalPages;

  const paymentDetails = groupPaymentDetails(dataResult.recordset);

  return res.json({ paymentDetails, page, pageSize: limit, total, totalPages, lastPage });
  } catch (error) {
    console.error('Failed to fetch payment details', error);
    return res.status(500).json({ error: 'Failed to fetch payment details' });
  }
});

module.exports = router;
