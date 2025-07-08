const fs = require('fs');
const path = require('path');

function buildLine(fields) {
  return fields.map(f => f != null ? String(f) : '').join('|') + '\n';
}

function generateFiles(order) {
  const timestamp = Date.now();
  const dir = path.join(__dirname, '..', 'exports', `order-${order.srx_order_id}-${timestamp}`);
  fs.mkdirSync(dir, { recursive: true });

  const headerPath = path.join(dir, 'orderquoteheader.txt');
  const linePath = path.join(dir, 'orderquoteline.txt');
  const headerNotesPath = path.join(dir, 'orderquoteheadernotes.txt');
  const lineNotesPath = path.join(dir, 'orderquotelinenotes.txt');

  const headerLines = [];
  const lineLines = [];
  const headerNotesLines = [];
  const lineNotesLines = [];

  // Basic header record
  headerLines.push(buildLine([
    order.srx_order_id,
    order.customer_id,
    order.sales_location_id,
    '' // placeholder for additional fields
  ]));

  if (order.notes) {
    headerNotesLines.push(buildLine([
      order.srx_order_id,
      order.notes
    ]));
  }

  order.lines.forEach((l, idx) => {
    lineLines.push(buildLine([
      order.srx_order_id,
      idx + 1,
      l.item_id,
      l.qty
    ]));

    if (l.notes) {
      lineNotesLines.push(buildLine([
        order.srx_order_id,
        idx + 1,
        l.notes
      ]));
    }
  });

  fs.writeFileSync(headerPath, headerLines.join(''));
  fs.writeFileSync(linePath, lineLines.join(''));
  if (headerNotesLines.length) fs.writeFileSync(headerNotesPath, headerNotesLines.join(''));
  if (lineNotesLines.length) fs.writeFileSync(lineNotesPath, lineNotesLines.join(''));

  return {
    headerPath,
    linePath,
    headerNotesPath: headerNotesLines.length ? headerNotesPath : null,
    lineNotesPath: lineNotesLines.length ? lineNotesPath : null,
    exportDir: dir
  };
}

module.exports = { generateFiles };
