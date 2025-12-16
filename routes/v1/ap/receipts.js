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

router.get('/', async (req, res) => {
  const receiptNumberParam = parseOptionalInt(req.query.receipt_number ?? req.query.receiptNumber);
  const poNumberParam = parseOptionalInt(req.query.po_number ?? req.query.poNumber);

  if (receiptNumberParam === undefined || poNumberParam === undefined) {
    return res.status(400).json({
      error: 'receipt_number/receiptNumber and po_number/poNumber must be integers when provided.'
    });
  }

  try {
    await sql.connect(config);

    const request = new sql.Request();
    request.input('receipt_number', sql.Int, receiptNumberParam);
    request.input('po_number', sql.Int, poNumberParam);

    const query = `
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
      LEFT JOIN drv_vendor_invoice_line dvil
        ON dvil.receipt_number = l.receipt_number
       AND dvil.po_line_number  = l.po_line_number
      WHERE h.delete_flag = 'N'
        AND (@receipt_number IS NULL OR h.receipt_number = @receipt_number)
        AND (@po_number      IS NULL OR h.po_number      = @po_number)
      ORDER BY h.receipt_number, l.po_line_number;
    `;

    const result = await request.query(query);
    return res.json(result.recordset || []);
  } catch (err) {
    console.error('Error fetching receipts', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
