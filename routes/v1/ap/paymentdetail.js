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

const toIsoString = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatPaymentDetail = (row) => ({
  companyNumber: row.company_no ? String(row.company_no).trim() : null,
  vendorId: row.vendor_id ? String(row.vendor_id).trim() : null,
  invoiceNumber: row.invoice_no ? String(row.invoice_no).trim() : null,
  invoiceDate: toIsoString(row.invoice_date),
  invoiceAmount: row.invoice_amount != null ? Number(row.invoice_amount) : null,
  voucherNumber: row.voucher_no ? String(row.voucher_no).trim() : null,
  checkNumber: row.check_no ? String(row.check_no).trim() : null,
  checkDate: toIsoString(row.check_date),
  currencyId: row.currency_id != null ? String(row.currency_id).trim() : null,
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
        apinv_hdr.paid_in_full,
        payment_detail.amount_paid,
        payment_detail.home_amt_paid,
        payment_detail.terms_amount_taken,
        payment_detail.amount_paid_display
      FROM apinv_hdr
      INNER JOIN payment_detail ON apinv_hdr.voucher_no = payment_detail.voucher_no
      ${whereClause}
      ORDER BY apinv_hdr.invoice_date DESC, apinv_hdr.voucher_no
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const dataResult = await dataRequest.query(query);

    const countRequest = new sql.Request();
    parameters.forEach((param) => {
      countRequest.input(param.name, param.type, param.value);
    });

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM apinv_hdr
      INNER JOIN payment_detail ON apinv_hdr.voucher_no = payment_detail.voucher_no
      ${whereClause};
    `;

    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0] ? Number(countResult.recordset[0].total) : 0;

    const paymentDetails = dataResult.recordset.map(formatPaymentDetail);

    return res.json({ paymentDetails, page, pageSize: limit, total });
  } catch (error) {
    console.error('Failed to fetch payment details', error);
    return res.status(500).json({ error: 'Failed to fetch payment details' });
  }
});

module.exports = router;
