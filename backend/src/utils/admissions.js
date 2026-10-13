function normalizeAdmissionValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
}

function normalizeAdmissionLevel(value) {
  const normalized = normalizeAdmissionValue(value);
  if (!normalized) return '';
  const match = normalized.match(/(?:level\s*)?(\d+)/i);
  return match ? match[1] : normalized;
}

const { parseCsvTable } = require('./csv');

function parseAdmissionsCsv(csv) {
  const rows = parseCsvTable(csv);
  const headers = Object.keys(rows[0].values);
  const indexOf = (names) => headers.find((header) => names.includes(header));
  const nameHeader = indexOf(['fullname', 'name', 'studentname']);
  if (!nameHeader) throw new Error('The CSV must include a full name column such as fullName or full_name.');

  const emailHeader = indexOf(['email', 'emailaddress']);
  const programmeHeader = indexOf(['programme', 'program', 'degree']);
  const departmentHeader = indexOf(['department', 'dept']);
  const levelHeader = indexOf(['level', 'year']);

  if (rows.length > 5000) throw new Error('Admission CSV files can contain at most 5,000 student rows.');
  return rows.map(({ rowNumber, values }) => {
    const fullName = values[nameHeader] || '';
    if (!fullName) throw new Error(`Admission CSV row ${rowNumber} has no full name.`);

    const email = emailHeader ? values[emailHeader] || '' : '';
    const programme = programmeHeader ? values[programmeHeader] || '' : '';
    const department = departmentHeader ? values[departmentHeader] || '' : '';
    const level = levelHeader ? values[levelHeader] || '' : '';

    return {
      fullName,
      normalizedFullName: normalizeAdmissionValue(fullName),
      email: email.toLowerCase(),
      programme,
      normalizedProgramme: normalizeAdmissionValue(programme),
      department,
      normalizedDepartment: normalizeAdmissionValue(department),
      level,
      normalizedLevel: normalizeAdmissionLevel(level),
    };
  });
}

module.exports = { normalizeAdmissionValue, normalizeAdmissionLevel, parseAdmissionsCsv };