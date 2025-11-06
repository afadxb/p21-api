const express = require('express');
const router = express.Router();
const { sql, config } = require('../db');

router.get('/item', async (req, res) => {
  try {
    await sql.connect(config);

    const {
      item_id,
      page = 1,
      paging = 'false',
      limit: queryLimit,
      order = 'asc',
      inactive
    } = req.query;

    const limit = parseInt(queryLimit) || 100;
    const usePaging = paging.toLowerCase() === 'true';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const request = new sql.Request();
    let filters = [];
    let whereClause = '';

    if (item_id) {
      filters.push('item_id = @item_id');
      request.input('item_id', sql.VarChar, item_id);
    }

    if (inactive !== undefined) {
      const isActive = inactive.toLowerCase() === 'false' ? 'N' : 'Y';
      filters.push('inactive = @inactive');
      request.input('inactive', sql.VarChar, isActive);
    }

    if (filters.length > 0) {
      whereClause = 'WHERE ' + filters.join(' AND ');
    }

    let query = '';
    let countQuery = '';
    let totalCount = 0;

    if (item_id) {
      query = `
        SELECT TOP (10) item_id, inv_mast_uid, item_desc, delete_flag, weight, net_weight, inactive, 
               default_sales_discount_group, extended_desc, keywords, base_unit, commodity_code, length, width, height
        FROM inv_mast
        ${whereClause}
        ORDER BY item_id ${sortOrder}
      `;
    } else if (usePaging) {
      const offset = (parseInt(page) - 1) * limit;

      query = `
        SELECT item_id, inv_mast_uid, item_desc, delete_flag, weight, net_weight, inactive, 
               default_sales_discount_group, extended_desc, keywords, base_unit, commodity_code, length, width, height
        FROM inv_mast
        ${whereClause}
        ORDER BY item_id ${sortOrder}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
      `;
      request.input('offset', sql.Int, offset);
      request.input('limit', sql.Int, limit);

      countQuery = `SELECT COUNT(*) as totalCount FROM inv_mast ${whereClause};`;
    } else {
      query = `
        SELECT TOP (@limit) item_id, inv_mast_uid, item_desc, delete_flag, weight, net_weight, inactive, 
               default_sales_discount_group, extended_desc, keywords, base_unit, commodity_code, length, width, height
        FROM inv_mast
        ${whereClause}
        ORDER BY item_id ${sortOrder}
      `;
      request.input('limit', sql.Int, limit);
    }

    const result = await request.query(query);

    if (usePaging && !item_id) {
      const countResult = await sql.query(countQuery);
      totalCount = countResult.recordset[0].totalCount;
    } else {
      totalCount = result.recordset.length;
    }

    res.json({
      data: result.recordset,
      totalCount: totalCount,
      page: usePaging ? parseInt(page) : 1,
      totalPages: usePaging ? Math.ceil(totalCount / limit) : 1
    });
  } catch (err) {
    console.error('SQL Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
