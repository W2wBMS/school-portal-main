function parseCsvRecords(csv) {
  const input = String(csv || '').replace(/^\uFEFF/, '');
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  const pushField = () => {
    record.push(field.trim());
    field = '';
    closedQuote = false;
  };
  const pushRecord = () => {
    pushField();
    if (record.some((value) => value.length > 0)) records.push(record);
    record = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.trim().length === 0 && !closedQuote) {
      field = '';
      quoted = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      pushRecord();
    } else if (closedQuote) {
      if (!/\s/.test(char)) throw new Error('CSV contains unexpected text after a quoted field.');
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (record.length || field.length || closedQuote) pushRecord();
  return records;
}

function normalizeCsvHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseCsvTable(csv) {
  const [rawHeaders, ...rows] = parseCsvRecords(csv);
  if (!rawHeaders || rows.length === 0) {
    throw new Error('The CSV must include a header row and at least one data row.');
  }

  const headers = rawHeaders.map(normalizeCsvHeader);
  if (headers.some((header) => !header)) throw new Error('CSV headers cannot be blank.');
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column headers.');

  return rows.map((cells, index) => {
    if (cells.length > headers.length) {
      throw new Error(`CSV row ${index + 2} has more values than the header row.`);
    }
    return {
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, cells[column] || ''])),
    };
  });
}

module.exports = { parseCsvRecords, parseCsvTable, normalizeCsvHeader };
