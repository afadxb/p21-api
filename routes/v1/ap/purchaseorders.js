const express = require('express');
const router = express.Router();
const { sql, config } = require('../../../db');
// const { apiKeyAuth } = require('../../../middleware/apiKeyAuth');
// router.use(apiKeyAuth('/v1/sales/order'));

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;
const DEFAULT_MIN_ORDER_DATE = new Date('2020-01-01T00:00:00Z');

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
  return trimmed;
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

const roundToDecimals = (value, decimals = 2) => {
  const number = safeNumber(value);
  if (number === null) {
    return null;
  }
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
};

const toBooleanFlag = (value) => value === 'Y';

const calculateAmount = (
  quantityOrdered,
  unitSizeValue,
  unitQuantityValue,
  pricingUnitSizeValue,
  unitPriceValue
) => {
  const qty = quantityOrdered ?? 0;
  const price = unitPriceValue ?? 0;

  if (qty === 0 || price === 0) {
    return 0;
  }

  const effectiveUnitSize = unitSizeValue ?? unitQuantityValue ?? 1;
  const effectivePricingUnitSize =
    pricingUnitSizeValue && pricingUnitSizeValue !== 0 ? pricingUnitSizeValue : 1;

  return ((qty * effectiveUnitSize) / effectivePricingUnitSize) * price;
};

const formatLine = (line, headerContext) => {
  const quantityOrdered = safeNumber(line.qty_ordered) ?? 0;
  const quantityReceived = safeNumber(line.qty_received) ?? 0;
  const quantityToVouch = safeNumber(line.qty_to_vouch);
  const unitSize = safeNumber(line.unit_size);
  const unitQuantity = safeNumber(line.unit_quantity);
  const pricingUnitSize = safeNumber(line.pricing_unit_size);
  const unitPrice = safeNumber(line.unit_price) ?? 0;
  const amount = roundToDecimals(
    calculateAmount(quantityOrdered, unitSize, unitQuantity, pricingUnitSize, unitPrice)
  );
  const baseUnitPrice = safeNumber(line.base_ut_price);
  const unitPriceDisplay = safeNumber(line.unit_price_display);
  const isCanceled = toBooleanFlag(line.cancel_flag);
  const isComplete = toBooleanFlag(line.complete);
  const isClosed = toBooleanFlag(line.closed_flag);
  const isVouchCompleted = toBooleanFlag(line.vouch_completed);
  const quantityChanged = toBooleanFlag(line.quantity_changed);

  return {
    erpSourceId: process.env.ERP_SOURCE_ID || 'P21',
    externalSystemId: `${headerContext.po_no};${String(line.line_no).trim()}`,
    isActive: line.delete_flag !== 'Y' && !isCanceled,
    amount,
    dimensions: line.gl_account_no ? String(line.gl_account_no).trim() : null,
    lineNumber: String(line.line_no).trim(),
    itemId: line.item_id ? String(line.item_id).trim() : null,
    itemDescription: line.item_desc ? String(line.item_desc).trim() : null,
    qtyOrdered: quantityOrdered,
    qtyReceived: quantityReceived,
    qtyToVouch: quantityToVouch,
    unitSize: unitSize ?? unitQuantity,
    unit: line.unit_of_measure ? String(line.unit_of_measure).trim() : null,
    pricingUnitSize,
    unitPrice,
    pricingUnit: line.pricing_unit ? String(line.pricing_unit).trim() : null,
    mfgPartNo: line.mfg_part_no ? String(line.mfg_part_no).trim() : null,
    isComplete,
    isCanceled,
    isClosed,
    isVouchCompleted,
    deleteFlag: line.delete_flag === 'Y',
    reference: headerContext.requested_by_name || null,
    reference2: headerContext.po_desc || null,
    //taxIndicator1: (line.tax_group_id ? String(line.tax_group_id).trim() || null : null),
    //taxIndicator2: null,
    isTwoWayMatch: 'true'
  };
};

const formatComment = (comment, headerContext) => {
  const identifier = comment.note_id ? String(comment.note_id).trim() : 'comment';

  return {
    erpSourceId: process.env.ERP_SOURCE_ID || 'P21',
    externalSystemId: `${headerContext.po_no};${identifier}`,
    commentDate: toIsoString(comment.date_created),
    comment: comment.comment_text || null
  };
};

const buildHeaderResponse = (header, lineMap, commentMap) => {
  const companyToken = buildCompanyToken(header.company_no);
  const vendorToken =
    header.vendor_id === null || header.vendor_id === undefined
      ? null
      : String(header.vendor_id).trim();
  const paymentTerm = String(header.terms).trim()
  const referenceNameParts = [header.first_name, header.last_name]
    .filter((part) => part && String(part).trim());
  const requestedByName = referenceNameParts.join(' ').trim() || null;
  const baseContext = {
    ...header,
    requested_by_name: requestedByName
  };

  const headerKey = getPoKey(header.po_no);

  const rawLines = lineMap.get(headerKey) || [];

  const lines = rawLines
    .map((line) => formatLine(line, baseContext))
    .sort((a, b) => {
      const aLine = Number(a.lineNumber);
      const bLine = Number(b.lineNumber);
      if (Number.isNaN(aLine) || Number.isNaN(bLine)) {
        return String(a.lineNumber).localeCompare(String(b.lineNumber));
      }
      return aLine - bLine;
    });

  const amount = roundToDecimals(rawLines
    .filter((line) => line.cancel_flag !== 'Y')
    .reduce((total, line) => {
      const quantity = safeNumber(line.qty_ordered);
      const unitSize = safeNumber(line.unit_size);
      const unitQuantity = safeNumber(line.unit_quantity);
      const pricingUnitSize = safeNumber(line.pricing_unit_size);
      const unitPrice = safeNumber(line.unit_price);

      return total + calculateAmount(
        quantity,
        unitSize,
        unitQuantity,
        pricingUnitSize,
        unitPrice
      );
    }, 0));

  const comments = (commentMap.get(headerKey) || [])
    .map((comment) => formatComment(comment, header))
    .sort((a, b) => (toTimestamp(a.commentDate) || 0) - (toTimestamp(b.commentDate) || 0));

  return {
    erpSourceId: process.env.ERP_SOURCE_ID || 'P21',
    externalSystemId: headerKey,
    isActive: header.delete_flag !== 'Y' && header.closed_flag !== 'Y',
    companyId: companyToken,
    location_id: header.location_id ? String(header.location_id).trim() : null,
    amount,
    currencyCode: mapCurrencyIdToCode(header.currency_id),
    orderIdentifier: header.po_no ? String(header.po_no).trim() : null,
    orderIdentifier2: header.external_po_no ? String(header.external_po_no).trim() : '',
    registerDate: toIsoString(header.order_date),
    dueDate: toIsoString(header.date_due),
    vendor: vendorToken,
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
    const poValue = header.po_no === null || header.po_no === undefined
      ? ''
      : String(header.po_no).trim();
    const companyValue = header.company_no === null || header.company_no === undefined
      ? ''
      : String(header.company_no).trim();

    request.input(`po${index}`, sql.VarChar, poValue);
    request.input(`company${index}`, sql.VarChar, companyValue);
  });
};

const buildHeaderFilters = (request, filters) => {
  const whereFragments = ['po_hdr.order_date >= @minOrderDate'];
  request.input('minOrderDate', sql.DateTime2, DEFAULT_MIN_ORDER_DATE);

  if (filters.poNo) {
    whereFragments.push('po_hdr.po_no = @poNo');
    request.input('poNo', sql.VarChar, filters.poNo);
  }
  if (filters.company) {
    whereFragments.push('po_hdr.company_no = @companyNo');
    request.input('companyNo', sql.VarChar, filters.company);
  }
  if (filters.vendor) {
    whereFragments.push('po_hdr.vendor_id = @vendorId');
    request.input('vendorId', sql.VarChar, filters.vendor);
  }
  if (filters.updatedSince) {
    whereFragments.push('po_hdr.date_last_modified >= @updatedSince');
    request.input('updatedSince', sql.DateTime2, filters.updatedSince);
  }
  if (filters.orderDateFrom) {
    whereFragments.push('po_hdr.order_date >= @orderDateFrom');
    request.input('orderDateFrom', sql.DateTime2, filters.orderDateFrom);
  }
  if (filters.orderDateTo) {
    whereFragments.push('po_hdr.order_date <= @orderDateTo');
    request.input('orderDateTo', sql.DateTime2, filters.orderDateTo);
  }

  return whereFragments;
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

  const whereFragments = buildHeaderFilters(headerRequest, filters);
  const whereClause = whereFragments.length ? `WHERE po_hdr.delete_flag='N' AND ${whereFragments.join(' AND ')}` : '';

  const countRequest = pool.request();
  const countWhereFragments = buildHeaderFilters(countRequest, filters);
  const countWhereClause = countWhereFragments.length
    ? `WHERE po_hdr.delete_flag='N' AND ${countWhereFragments.join(' AND ')}`
    : '';
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM po_hdr
    ${countWhereClause};
  `;
  const countResult = await countRequest.query(countQuery);
  const total = countResult.recordset?.[0]?.total ?? 0;

  const headerQuery = `
    SELECT
      po_hdr.po_no,
      po_hdr.company_no,
      po_hdr.vendor_id,
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
  const limitedHeaders = headers;

  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  const lastPage = totalPages === 0 ? page === 1 : page >= totalPages;

  const footer = {
    page,
    pageSize: limit,
    total,
    totalPages,
    lastPage
  };

  if (limitedHeaders.length === 0) {
    return {
      purchaseOrders: [],
      footer
    };
  }

  const lineRequest = pool.request();
  const commentRequest = pool.request();

  const compositeWhere = buildCompositeWhereClause('line', limitedHeaders);
  const commentCompositeWhere = buildCompositeWhereClause('hdr', limitedHeaders);

  addHeaderIdentifiers(lineRequest, limitedHeaders);
  addHeaderIdentifiers(commentRequest, limitedHeaders);

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
    WHERE line.delete_flag='N' AND ${compositeWhere};
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

  const purchaseOrders = limitedHeaders.map((header) => buildHeaderResponse(header, lineMap, commentMap));

  return {
    purchaseOrders,
    footer
  };
};

router.get('/', async (req, res) => {
  try {
    const filters = {};

    const companyQuery = req.query.company || req.query.companyId;
    if (companyQuery) {
      filters.company = String(companyQuery).trim();
    }
    const vendorQuery = req.query.vendor || req.query.vendorId;
    if (vendorQuery) {
      filters.vendor = String(vendorQuery).trim();
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

    const { purchaseOrders, footer } = await fetchPurchaseOrders(filters, options);
    res.json({ purchaseOrders, footer });
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

    const { purchaseOrders } = await fetchPurchaseOrders(filters, { page: 1, limit: 1 });
    if (!purchaseOrders || purchaseOrders.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    return res.json(purchaseOrders[0]);
  } catch (error) {
    console.error('Failed to fetch purchase order', error);
    return res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

module.exports = router;
