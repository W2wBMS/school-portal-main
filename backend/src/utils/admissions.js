function normalizeAdmissionValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
}

function normalizeAdmissionLevel(value) {
  const normalized = normalizeAdmissionValue(value);
  if (!normalized) return '';
  const match = normalized.match(/(?:level\s*)?(\d+)/i);
  return match ? match[1] : normalized;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseAdmissionsCsv(csv) {
  const lines = String(csv || '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('The CSV must include a header row and at least one student row.');

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[\s_-]/g, ''));
  const indexOf = (names) => headers.findIndex((header) => names.includes(header));
  const nameIndex = indexOf(['fullname', 'name', 'studentname']);
  if (nameIndex < 0) throw new Error('The CSV must include a full name column such as fullName or full_name.');

  const emailIndex = indexOf(['email', 'emailaddress']);
  const programmeIndex = indexOf(['programme', 'program', 'degree']);
  const departmentIndex = indexOf(['department', 'dept']);
  const levelIndex = indexOf(['level', 'year']);

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const fullName = cells[nameIndex] || '';
    if (!fullName) throw new Error(`Admission CSV row ${index + 2} has no full name.`);

    const email = emailIndex < 0 ? '' : cells[emailIndex] || '';
    const programme = programmeIndex < 0 ? '' : cells[programmeIndex] || '';
    const department = departmentIndex < 0 ? '' : cells[departmentIndex] || '';
    const level = levelIndex < 0 ? '' : cells[levelIndex] || '';

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