const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');
const { getPagingParams } = require('../../../utils/paging');

// GET /v1/inventory/items (list)
router.get('/', async (req, res) => {
  try {
    await sql.connect(config);
    const { page, limit, order, paging, offset } = getPagingParams(req);

    const request = new sql.Request();
    request.input('limit', sql.Int, limit);

    const filters = [];
    if (req.query.inactive !== undefined) {
      const isActive = req.query.inactive.toLowerCase() === 'false' ? 'N' : 'Y';
      filters.push('inactive = @inactive');
      request.input('inactive', sql.VarChar, isActive);
    }

    const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';

    let query;
    if (paging) {
      query = `
        SELECT item_id, item_desc FROM inv_mast
        ${whereClause}
        ORDER BY item_id ${order}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
      `;
      request.input('offset', sql.Int, offset);
    } else {
      query = `
        SELECT TOP (@limit) item_id, item_desc FROM inv_mast
        ${whereClause}
        ORDER BY item_id ${order};
      `;
    }

    const result = await request.query(query);

    let totalCount = result.recordset.length;
    if (paging) {
      const countQuery = `SELECT COUNT(*) as totalCount FROM inv_mast ${whereClause}`;
      const countResult = await sql.query(countQuery);
      totalCount = countResult.recordset[0].totalCount;
    }

    res.json({
      data: result.recordset,
      totalCount,
      page,
      totalPages: paging ? Math.ceil(totalCount / limit) : 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /v1/inventory/items/:item_id
router.get('/:item_id', async (req, res) => {
  try {
    await sql.connect(config);
    const rawId = req.params.item_id || '';
    const itemId = rawId.trim().substring(0, 50); // sanitize input
    const request = new sql.Request();
    request.input('item_id', sql.VarChar, itemId);

    const result = await request.query(`
      SELECT TOP (1) item_id, inv_mast_uid, item_desc, delete_flag, weight, net_weight, inactive,
        default_sales_discount_group, extended_desc, keywords, base_unit, commodity_code, length, width, height
      FROM inv_mast
      WHERE item_id = @item_id
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

