const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_MIN_ORDER_DATE = new Date('2018-01-01T00:00:00Z');

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

const toTimestamp = (value) => {
  const date = normalizeDate(value);
  return date ? date.getTime() : null;
};

const getPoKey = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

const buildCompanyToken = (companyNo) => {
  if (!companyNo && companyNo !== 0) {
    return null;
  }
  const trimmed = String(companyNo).trim();
  return trimmed ? `company[${trimmed}]` : null;
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
  const date = normalizeDate(value);
  return date ? date.toISOString() : null;
};

const safeNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const formatLine = (line, headerContext) => {
  const companyToken = buildCompanyToken(headerContext.company_no);
  const quantity = safeNumber(line.qty_ordered) ?? 0;
  const unitPrice = safeNumber(line.unit_price) ?? 0;
  const amount = quantity * unitPrice;

  return {
    erpSourceId: process.env.ERP_SOURCE_ID || 'P21',
    externalSystemId: companyToken
      ? `${companyToken};${headerContext.po_no};${String(line.line_no).trim()}`
      : `${headerContext.po_no};${String(line.line_no).trim()}`,
    isActive: line.delete_flag !== 'Y',
    amount,
    dimensions: line.gl_account_no ? String(line.gl_account_no).trim() : null,
    itemDescription: line.item_desc ? String(line.item_desc).trim() : null,
    itemNumber: line.item_id ? String(line.item_id).trim() : null,
    lineNumber: String(line.line_no).trim(),
    itemId: line.inv_mast_uid ? String(line.inv_mast_uid).trim() : '',
    quantity,
    unitSize: safeNumber(line.unit_size) ?? safeNumber(line.unit_quantity),
    unit: line.unit_of_measure ? String(line.unit_of_measure).trim() : null,
    unitPrice,
    reference: headerContext.requested_by_name || null,
    reference2: headerContext.po_desc || null,
    taxIndicator1: line.tax_group_id && companyToken
      ? `${companyToken};${String(line.tax_group_id).trim()}`
      : line.tax_group_id ? String(line.tax_group_id).trim() : null,
    taxIndicator2: null,
    isServiceBased: false,
    isTwoWayMatch: line.vouch_completed === 'Y' ? false : true
  };
};

const formatComment = (comment, headerContext) => {
  const companyToken = buildCompanyToken(headerContext.company_no);
  const identifier = comment.note_id ? String(comment.note_id).trim() : 'comment';

  return {
    erpSourceId: process.env.ERP_SOURCE_ID || 'P21',
    externalSystemId: companyToken
      ? `${companyToken};${headerContext.po_no};${identifier}`
      : `${headerContext.po_no};${identifier}`,
    commentDate: toIsoString(comment.date_created),
    comment: comment.comment_text || null
  };
};

const buildHeaderResponse = (header, lineMap, commentMap) => {
  const companyToken = buildCompanyToken(header.company_no);
  const supplierToken = header.supplier_id && companyToken
    ? `${companyToken};${String(header.supplier_id).trim()}`
    : header.supplier_id ? String(header.supplier_id).trim() : null;
  const paymentTerm = header.terms && companyToken
    ? `${companyToken};${String(header.terms).trim()}`
    : header.terms ? String(header.terms).trim() : null;
  const referenceNameParts = [header.first_name, header.last_name]
    .filter((part) => part && String(part).trim());
  const requestedByName = referenceNameParts.join(' ').trim() || null;
  const baseContext = {
    ...header,
    requested_by_name: requestedByName
  };

  const headerKey = getPoKey(header.po_no);

  const lines = (lineMap.get(headerKey) || [])
    .map((line) => formatLine(line, baseContext))
    .sort((a, b) => {
      const aLine = Number(a.lineNumber);
      const bLine = Number(b.lineNumber);
      if (Number.isNaN(aLine) || Number.isNaN(bLine)) {
        return String(a.lineNumber).localeCompare(String(b.lineNumber));
      }
      return aLine - bLine;
    });

  const amount = lines.reduce((total, line) => total + (safeNumber(line.amount) || 0), 0);

  const comments = (commentMap.get(headerKey) || [])
    .map((comment) => formatComment(comment, header))
    .sort((a, b) => (toTimestamp(a.commentDate) || 0) - (toTimestamp(b.commentDate) || 0));

  return {
    erpSourceId: process.env.ERP_SOURCE_ID || 'P21',
    externalSystemId: companyToken
      ? `${companyToken};${headerKey}`
      : headerKey,
    isActive: header.delete_flag !== 'Y' && header.closed_flag !== 'Y',
    companyId: companyToken,
    amount,
    currencyCode: mapCurrencyIdToCode(header.currency_id),
    orderIdentifier: header.po_no ? String(header.po_no).trim() : null,
    orderIdentifier2: header.external_po_no ? String(header.external_po_no).trim() : '',
    registerDate: toIsoString(header.order_date),
    dueDate: toIsoString(header.date_due),
    supplier: supplierToken,
    reference: requestedByName,
    reference2: header.po_desc ? String(header.po_desc).trim() : '',
    paymentTerm,
    purchaseOrderLines: lines,
    purchaseOrderComments: comments
  };
};

const buildCompositeWhereClause = (alias, headers) => {
  const conditions = headers.map((header, index) => `(${alias}.po_no = @po${index} AND ${alias}.company_no = @company${index})`);
  return conditions.join(' OR ');
};

const addHeaderIdentifiers = (request, headers) => {
  headers.forEach((header, index) => {
    request.input(`po${index}`, sql.VarChar, header.po_no);
    request.input(`company${index}`, sql.VarChar, header.company_no);
  });
};

const fetchPurchaseOrders = async (filters, options = {}) => {
  const page = parsePositiveInt(options.page, 1);
  const requestedLimit = parsePositiveInt(options.limit, DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const offset = (page - 1) * limit;

  const pool = await sql.connect(config);

  const headerRequest = pool.request();
  headerRequest.input('offset', sql.Int, offset);
  headerRequest.input('limit', sql.Int, limit);

  const whereFragments = ['po_hdr.order_date >= @minOrderDate'];
  headerRequest.input('minOrderDate', sql.DateTime2, DEFAULT_MIN_ORDER_DATE);

  if (filters.poNo) {
    whereFragments.push('po_hdr.po_no = @poNo');
    headerRequest.input('poNo', sql.VarChar, filters.poNo);
  }
  if (filters.company) {
    whereFragments.push('po_hdr.company_no = @companyNo');
    headerRequest.input('companyNo', sql.VarChar, filters.company);
  }
  if (filters.supplier) {
    whereFragments.push('po_hdr.supplier_id = @supplierId');
    headerRequest.input('supplierId', sql.VarChar, filters.supplier);
  }
  if (filters.updatedSince) {
    whereFragments.push('po_hdr.date_last_modified >= @updatedSince');
    headerRequest.input('updatedSince', sql.DateTime2, filters.updatedSince);
  }
  if (filters.orderDateFrom) {
    whereFragments.push('po_hdr.order_date >= @orderDateFrom');
    headerRequest.input('orderDateFrom', sql.DateTime2, filters.orderDateFrom);
  }
  if (filters.orderDateTo) {
    whereFragments.push('po_hdr.order_date <= @orderDateTo');
    headerRequest.input('orderDateTo', sql.DateTime2, filters.orderDateTo);
  }

  const whereClause = whereFragments.length ? `WHERE ${whereFragments.join(' AND ')}` : '';

  const headerQuery = `
    SELECT
      po_hdr.po_no,
      po_hdr.company_no,
      po_hdr.vendor_id,
      po_hdr.supplier_id,
      po_hdr.location_id,
      po_hdr.requested_by,
      po_hdr.order_date,
      po_hdr.date_due,
      po_hdr.approved,
      po_hdr.complete,
      po_hdr.delete_flag,
      po_hdr.terms,
      po_hdr.po_desc,
      po_hdr.date_created,
      po_hdr.date_last_modified,
      po_hdr.closed_flag,
      po_hdr.currency_id,
      po_hdr.exchange_rate,
      po_hdr.external_po_no,
      po_hdr.po_hdr_uid,
      po_hdr.revised_po,
      po_hdr.po_type,
      contacts.first_name,
      contacts.last_name
    FROM po_hdr
    LEFT JOIN contacts ON contacts.id = po_hdr.requested_by
    ${whereClause}
    ORDER BY po_hdr.order_date DESC, po_hdr.po_no DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `;

  const headerResult = await headerRequest.query(headerQuery);
  const headers = headerResult.recordset || [];

  if (headers.length === 0) {
    return [];
  }

  const lineRequest = pool.request();
  const commentRequest = pool.request();

  const compositeWhere = buildCompositeWhereClause('line', headers);
  const commentCompositeWhere = buildCompositeWhereClause('hdr', headers);

  addHeaderIdentifiers(lineRequest, headers);
  addHeaderIdentifiers(commentRequest, headers);

  const lineQuery = `
    SELECT
      line.po_no,
      line.company_no,
      line.line_no,
      line.item_id,
      line.item_desc,
      line.qty_ordered,
      line.qty_received,
      line.unit_price,
      line.unit_of_measure,
      line.unit_size,
      line.unit_quantity,
      line.date_due,
      line.date_created,
      line.date_last_modified,
      line.required_date,
      line.delete_flag,
      line.complete,
      line.vouch_completed,
      line.cancel_flag,
      line.qty_to_vouch,
      line.closed_flag,
      line.mfg_part_no,
      line.base_ut_price,
      line.quantity_changed,
      line.pricing_unit,
      line.pricing_unit_size,
      line.unit_price_display,
      line.inv_mast_uid,
      inv_loc.tax_group_id AS tax_group_id,
      inv_loc.gl_account_no AS gl_account_no
    FROM p21_view_po_line AS line WITH (NOLOCK)
    INNER JOIN po_hdr ON po_hdr.po_no = line.po_no AND po_hdr.company_no = line.company_no
    LEFT JOIN inv_loc ON inv_loc.inv_mast_uid = line.inv_mast_uid AND inv_loc.location_id = po_hdr.location_id
    WHERE ${compositeWhere};
  `;

  const commentQuery = `
    SELECT
      note.po_no,
      hdr.company_no,
      note.note_id,
      note.topic,
      CAST(note.note AS VARCHAR(MAX)) AS note_body,
      note.date_created
    FROM po_hdr_notepad AS note
    INNER JOIN po_hdr AS hdr ON hdr.po_no = note.po_no
    WHERE ${commentCompositeWhere};
  `;

  const [lineResult, commentResult] = await Promise.all([
    lineRequest.query(lineQuery),
    commentRequest.query(commentQuery)
  ]);

  const lineMap = new Map();
  (lineResult.recordset || []).forEach((line) => {
    const key = getPoKey(line.po_no);
    if (!lineMap.has(key)) {
      lineMap.set(key, []);
    }
    lineMap.get(key).push(line);
  });

  const commentMap = new Map();
  (commentResult.recordset || []).forEach((comment) => {
    const key = getPoKey(comment.po_no);
    if (!commentMap.has(key)) {
      commentMap.set(key, []);
    }
    commentMap.get(key).push({
      ...comment,
      comment_text: [comment.topic, comment.note_body]
        .filter((part) => part && String(part).trim())
        .join(' ')
        .trim()
    });
  });

  return headers.map((header) => buildHeaderResponse(header, lineMap, commentMap));
};

router.get('/', async (req, res) => {
  try {
    const filters = {};

    const companyQuery = req.query.company || req.query.companyId;
    if (companyQuery) {
      filters.company = String(companyQuery).trim();
    }
    const supplierQuery = req.query.supplier || req.query.supplierId;
    if (supplierQuery) {
      filters.supplier = String(supplierQuery).trim();
    }
    const poNumberQuery = req.query.po_no || req.query.poNo || req.query.poNumber;
    if (poNumberQuery) {
      filters.poNo = String(poNumberQuery).trim();
    }

    const updatedSinceRaw = req.query.updated_since || req.query.updatedSince;
    if (updatedSinceRaw) {
      const updatedSince = normalizeDate(updatedSinceRaw);
      if (!updatedSince) {
        return res.status(400).json({ error: 'Invalid updated_since parameter. Expecting ISO 8601 date.' });
      }
      filters.updatedSince = updatedSince;
    }

    const orderDateFromRaw = req.query.order_date_from || req.query.orderDateFrom;
    if (orderDateFromRaw) {
      const orderDateFrom = normalizeDate(orderDateFromRaw);
      if (!orderDateFrom) {
        return res.status(400).json({ error: 'Invalid order_date_from parameter. Expecting ISO 8601 date.' });
      }
      filters.orderDateFrom = orderDateFrom;
    }

    const orderDateToRaw = req.query.order_date_to || req.query.orderDateTo;
    if (orderDateToRaw) {
      const orderDateTo = normalizeDate(orderDateToRaw);
      if (!orderDateTo) {
        return res.status(400).json({ error: 'Invalid order_date_to parameter. Expecting ISO 8601 date.' });
      }
      filters.orderDateTo = orderDateTo;
    }

    const options = {
      page: req.query.page,
      limit: req.query.limit || req.query.pageSize || req.query.page_size
    };

    const data = await fetchPurchaseOrders(filters, options);
    res.json({ purchaseOrders: data });
  } catch (error) {
    console.error('Failed to fetch purchase orders', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

router.get('/:poNo', async (req, res) => {
  try {
    const filters = { poNo: String(req.params.poNo).trim() };
    const companyQuery = req.query.company || req.query.companyId;
    if (companyQuery) {
      filters.company = String(companyQuery).trim();
    }

    const updatedSinceRaw = req.query.updated_since || req.query.updatedSince;
    if (updatedSinceRaw) {
      const updatedSince = normalizeDate(updatedSinceRaw);
      if (!updatedSince) {
        return res.status(400).json({ error: 'Invalid updated_since parameter. Expecting ISO 8601 date.' });
      }
      filters.updatedSince = updatedSince;
    }

    const data = await fetchPurchaseOrders(filters, { page: 1, limit: 1 });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    return res.json(data[0]);
  } catch (error) {
    console.error('Failed to fetch purchase order', error);
    return res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

module.exports = router;
