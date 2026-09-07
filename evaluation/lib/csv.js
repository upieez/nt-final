// Minimal RFC 4180 reader: quoted fields, doubled quotes, embedded newlines, CRLF or LF line ends
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  while (i < source.length) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') quoted = false;
      else field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Rows as objects keyed by header; the first row is the header
function readRecords(text) {
  const [headers = [], ...rows] = parseCsv(text);
  return { headers, records: rows.map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] || '').trim()]))) };
}

module.exports = { parseCsv, readRecords };
