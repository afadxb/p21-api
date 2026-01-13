const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;
const DEFAULT_MIN_ORDER_DATE = new Date('2020-01-01T00:00:00Z');
const DEFAULT_MIN_LAST_MODIFIED = new Date('2020-01-01T00:00:00Z');

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

router.get('/', async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1);
  const requestedLimit = req.query.limit ?? req.query.page_size ?? req.query.pageSize;
  let limit = parsePositiveInt(requestedLimit, DEFAULT_LIMIT);
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }
  const offset = (page - 1) * limit;

  const receiptNumberParam = parseOptionalInt(req.query.receipt_number ?? req.query.receiptNumber);
  const poNumberParam = parseOptionalInt(req.query.po_number ?? req.query.poNumber);
  const updatedSinceRaw = req.query.updated_since ?? req.query.updatedSince;
  let updatedSinceParam = null;

  if (updatedSinceRaw !== undefined) {
    const parsedDate = new Date(updatedSinceRaw);

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        error: 'updated_since/updatedSince must be a valid date.'
      });
    }

    updatedSinceParam = parsedDate;
  }

  if (receiptNumberParam === undefined || poNumberParam === undefined) {
    return res.status(400).json({
      error: 'receipt_number/receiptNumber and po_number/poNumber must be integers when provided.'
    });
  }

  try {
    await sql.connect(config);

    const parameters = [
      { name: 'receipt_number', type: sql.Int, value: receiptNumberParam },
      { name: 'po_number', type: sql.Int, value: poNumberParam },
      { name: 'min_order_date', type: sql.DateTime, value: DEFAULT_MIN_ORDER_DATE },
      { name: 'min_last_modified', type: sql.DateTime2, value: DEFAULT_MIN_LAST_MODIFIED }
    ];

    if (updatedSinceParam !== null) {
      parameters.push({ name: 'updated_since', type: sql.DateTime, value: updatedSinceParam });
    }

    const dataRequest = new sql.Request();
    const countRequest = new sql.Request();

    parameters.forEach((param) => {
      dataRequest.input(param.name, param.type, param.value);
      countRequest.input(param.name, param.type, param.value);
    });

    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, limit);

    const whereClauses = [
      "h.delete_flag = 'N'",
      'h.date_created >= @min_order_date',
      'h.date_last_modified >= @min_last_modified'
    ];
    if (receiptNumberParam !== null) {
      whereClauses.push('h.receipt_number = @receipt_number');
    }
    if (poNumberParam !== null) {
      whereClauses.push('h.po_number = @po_number');
    }
    if (updatedSinceParam !== null) {
      whereClauses.push('h.date_last_modified >= @updated_since');
    }

    const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const dataQuery = `
      /* Receipt header + line items (hdr + line + inv_mast) with computed vouch_complete */
      ;WITH drv_vendor_invoice_line AS (
          SELECT
              vil.receipt_number,
              vil.po_line_number,
              SUM(CASE WHEN vil.reconciled_flag = 'N' THEN 1 ELSE 0 END) AS unreconciled_count,
              SUM(vil.quantity_invoiced) AS quantity_invoiced
          FROM vendor_invoice_line vil
          WHERE vil.row_status_flag <> 700
          GROUP BY vil.receipt_number, vil.po_line_number
      )
      SELECT
          -- Header (inventory_receipts_hdr)
          h.receipt_number,
          h.po_number,
          po_hdr.company_no,
          po_hdr.location_id,
          h.currency_id,
          h.approved,
          h.date_created,
          h.date_last_modified,

          -- Lines (inventory_receipts_line)
          l.po_line_number,
          l.qty_received,
          l.unit_size,
          l.unit_of_measure,
          l.unit_cost,
          l.extended_cost,
          l.pricing_unit,
          l.pricing_unit_size,

          -- Item (inv_mast)
          im.item_id,
          im.item_desc,

          -- Derived
          CASE
              WHEN COALESCE(dvil.receipt_number, 0) <> 0 THEN
                  CASE
                      WHEN dvil.quantity_invoiced >= l.qty_received
                           AND dvil.unreconciled_count = 0
                      THEN 'Y' ELSE 'N'
                  END
              ELSE l.vouch_complete
          END AS vouch_complete
      FROM inventory_receipts_hdr  h
      JOIN inventory_receipts_line l
        ON l.receipt_number = h.receipt_number
      JOIN inv_mast im
        ON im.inv_mast_uid = l.inv_mast_uid
      JOIN po_hdr
        ON h.po_number = po_hdr.po_no
      LEFT JOIN drv_vendor_invoice_line dvil
        ON dvil.receipt_number = l.receipt_number
       AND dvil.po_line_number  = l.po_line_number
      ${whereClause}
      ORDER BY h.receipt_number, l.po_line_number
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM inventory_receipts_hdr h
      JOIN inventory_receipts_line l
        ON l.receipt_number = h.receipt_number
      JOIN inv_mast im
        ON im.inv_mast_uid = l.inv_mast_uid
      JOIN po_hdr
        ON h.po_number = po_hdr.po_no
      ${whereClause};
    `;

    const [dataResult, countResult] = await Promise.all([
      dataRequest.query(dataQuery),
      countRequest.query(countQuery)
    ]);

    const receiptRows = dataResult.recordset || [];
    const receipts = [];
    const receiptMap = new Map();

    receiptRows.forEach((row) => {
      let receipt = receiptMap.get(row.receipt_number);

      if (!receipt) {
        receipt = {
          receipt_number: row.receipt_number,
          po_number: row.po_number,
          companyId: row.company_no ? String(row.company_no).trim() : null,
          location_id: row.location_id ? String(row.location_id).trim() : null,
          currency: mapCurrencyIdToCode(row.currency_id),
          date_created: row.date_created,
          date_last_modified: row.date_last_modified,
          approved: row.approved,          
          lines: []
        };

        receiptMap.set(row.receipt_number, receipt);
        receipts.push(receipt);
      }

      receipt.lines.push({
        po_line_number: row.po_line_number,
        item_id: row.item_id,
        item_desc: row.item_desc,        
        qty_received: row.qty_received,
        unit_size: row.unit_size,
        unit: row.unit_of_measure,
        unit_cost: row.unit_cost,
        unitprice: row.pricing_unit,
        total: row.extended_cost,
        Uniypricing_unit: row.pricing_unit,
        unitprice_size: row.pricing_unit_size,
        vouch_complete: row.vouch_complete
      });
    });

    const total = countResult.recordset[0] ? Number(countResult.recordset[0].total) : 0;
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    const lastPage = totalPages === 0 ? page === 1 : page >= totalPages;

    return res.json({ receipts: receipts, page, limit, total, totalPages, lastPage });
  } catch (err) {
    console.error('Error fetching receipts', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
