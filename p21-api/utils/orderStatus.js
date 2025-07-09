function computeHeaderStatus(header) {
  const del = (header.delete_flag || '').trim().toUpperCase();
  const cancel = (header.cancel_flag || '').trim().toUpperCase();
  const completed = (header.completed || '').trim().toUpperCase();
  const approved = (header.approved || '').trim().toUpperCase();
  if (cancel === 'Y') return 'Canceled';
  if (del === 'Y') return 'Deleted';
  if (completed === 'Y' && approved === 'Y') return 'Completed';
  if (approved === 'N') return 'Unapproved';
  return 'Open';
}

function computeLineStatus(line) {
  const del = (line.delete_flag || '').trim().toUpperCase();
  const cancel = (line.cancel_flag || '').trim().toUpperCase();
  const qtyOrdered = Number(line.qty_ordered) || 0;
  const qtyAllocated = Number(line.qty_allocated) || 0;
  const qtyInvoiced = Number(line.qty_invoiced) || 0;
  const qtyCanceled = Number(line.qty_canceled) || 0;
  if (qtyInvoiced === qtyOrdered && qtyOrdered > 0) return 'Fulfilled';
  if (qtyInvoiced > 0 && qtyInvoiced < qtyOrdered) return 'Partially Fulfilled';
  if (cancel === 'Y') return 'Canceled';
  if (del === 'Y') return 'Deleted';
  if (qtyAllocated > 0) return 'In Progress';
  if (qtyOrdered > 0 && qtyAllocated === 0 && qtyInvoiced === 0 && qtyCanceled === 0) {
    return 'New';
  }
  return 'Open';
}

module.exports = { computeHeaderStatus, computeLineStatus };
