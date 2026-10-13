const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvRecords, parseCsvTable } = require('../src/utils/csv');
const { parseAdmissionsCsv } = require('../src/utils/admissions');

test('CSV parser handles BOM, quoted commas, escaped quotes, and multiline fields', () => {
  const records = parseCsvRecords('\uFEFFname,programme,notes\r\n"Doe, Jane","BSc ""Honours""", "First line\nSecond line"');
  assert.deepEqual(records, [
    ['name', 'programme', 'notes'],
    ['Doe, Jane', 'BSc "Honours"', 'First line\nSecond line'],
  ]);
});

test('CSV table normalizes headers and rejects duplicate normalized columns', () => {
  const table = parseCsvTable('Full Name,credit_hours\nAma Mensah,3');
  assert.deepEqual(table[0].values, { fullname: 'Ama Mensah', credithours: '3' });
  assert.throws(() => parseCsvTable('full name,full_name\nAma Mensah,Ama Mensah'), /duplicate column headers/i);
});

test('CSV parser reports malformed quoted fields instead of silently shifting columns', () => {
  assert.throws(() => parseCsvRecords('name,email\nAma,"ama@example.com'), /unclosed quoted field/i);
});

test('admission CSV accepts quoted names containing commas and a UTF-8 BOM', () => {
  const records = parseAdmissionsCsv('\uFEFFfull_name,programme,email\n"Doe, Jane",Computer Science,jane@example.edu');
  assert.equal(records[0].fullName, 'Doe, Jane');
  assert.equal(records[0].normalizedFullName, 'doe jane');
  assert.equal(records[0].email, 'jane@example.edu');
});
