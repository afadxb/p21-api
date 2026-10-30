// Formatting helpers shared by the TMP_* export jobs (tab-delimited P21 import files)

function normaliseYear(yearPart) {
  if (!yearPart) {
    return '';
  }

  if (yearPart.length === 2) {
    const yearNumber = Number(yearPart);
    if (Number.isNaN(yearNumber)) {
      return yearPart;
    }
    return yearNumber >= 70 ? `19${yearPart}` : `20${yearPart}`;
  }

  return yearPart;
}

function formatDate(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }

  if (/^\d{8}$/.test(value)) {
    if (value === '00000000') {
      return '';
    }

    const maybeMonth = Number(value.slice(0, 2));

    if (Number.isFinite(maybeMonth) && maybeMonth > 12) {
      const year = value.slice(0, 4);
      const month = value.slice(4, 6);
      const day = value.slice(6, 8);
      return `${month}/${day}/${normaliseYear(year)}`;
    }

    const month = value.slice(0, 2);
    const day = value.slice(2, 4);
    const year = value.slice(4, 8);
    return `${month}/${day}/${normaliseYear(year)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (value === '0000-00-00') {
      return '';
    }

    const [year, month, day] = value.split('-');
    return `${month}/${day}/${normaliseYear(year)}`;
  }

  return value;
}

function formatQuantity(raw) {
  if (raw === null || raw === undefined) {
    return '';
  }
  const num = Number(raw);
  if (Number.isNaN(num)) {
    return String(raw);
  }
  if (Number.isInteger(num)) {
    return String(num);
  }
  return num.toString();
}

function formatPrice(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return '';
  }
  const num = Number(raw);
  if (Number.isNaN(num)) {
    return String(raw);
  }
  const trimmed = num.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return trimmed || '0';
}

function prepareField(value, { width, zeroPadLength }) {
  let output = value === null || value === undefined ? '' : String(value).trim();

  if (zeroPadLength && output) {
    output = output.padStart(zeroPadLength, '0');
  }

  if (width && output.length > width) {
    output = output.slice(0, width);
  }

  return output;
}

function formatRecord(record, layout) {
  return layout
    .map((field) => {
      const rawValue = record[field.key];
      const value = field.formatter ? field.formatter(rawValue, record) : rawValue;
      return prepareField(value, field);
    })
    .join('\t');
}

module.exports = {
  normaliseYear,
  formatDate,
  formatQuantity,
  formatPrice,
  prepareField,
  formatRecord
};
