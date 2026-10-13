const crypto = require('crypto');
const express = require('express');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const AdmissionList = require('../models/AdmissionList');
const AuditLog = require('../models/AuditLog');
const { protect, authorize, authorizePermission } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { sendPasswordResetEmail } = require('../utils/mail');
const { parseAdmissionsCsv } = require('../utils/admissions');
const { z } = require('zod');

const router = express.Router();
const BASIC_ACCOUNT_ROLES = ['student', 'lecturer'];
const PRIVILEGED_CREATOR_ROLES = ['system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'];
const ALL_ACCOUNT_ROLES = [...BASIC_ACCOUNT_ROLES, 'department_admin', 'academic_officer', 'finance_officer', 'student_affairs', ...PRIVILEGED_CREATOR_ROLES];
const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
  role: z.enum(ALL_ACCOUNT_ROLES).default('student'),
}).strict();

function canCreatePrivilegedUsers(role) {
  return PRIVILEGED_CREATOR_ROLES.includes(role);
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
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function normalizeCsvRow(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

router.get('/me', protect, async (req, res) => {
  return res.json({ user: req.user });
});

router.get('/', protect, authorize('student_affairs', 'department_admin', 'academic_officer', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  return res.json({ users });
});

router.get('/audit-logs', protect, authorizePermission('audit.view'), async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
  const filter = {};
  if (typeof req.query.entity === 'string' && req.query.entity.trim()) filter.entity = req.query.entity.trim();
  if (typeof req.query.action === 'string' && req.query.action.trim()) {
    const escaped = req.query.action.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.action = { $regex: escaped, $options: 'i' };
  }

  try {
    let rawLogs = [];
    try {
      rawLogs = await AuditLog.find(filter)
        .populate('actorId', 'fullName email role')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch (popErr) {
      console.warn('Populate failed on audit logs, falling back to basic query:', popErr.message);
      rawLogs = await AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    }

    const logs = rawLogs
      .filter((log) => !log.actorId || typeof log.actorId !== 'object' || log.actorId.role !== 'student')
      .map((log) => ({
        _id: log._id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata,
        createdAt: log.createdAt,
        actorId: log.actorId && typeof log.actorId === 'object'
          ? {
              fullName: log.actorId.fullName,
              email: log.actorId.email,
              role: log.actorId.role,
            }
          : null,
      }));

    return res.json({ logs });
  } catch (error) {
    console.error('Audit logs query error:', error);
    return res.status(500).json({ message: 'Unable to retrieve audit logs.' });
  }
});

router.post('/', protect, authorize('student_affairs', 'department_admin', 'academic_officer', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid name, email, and password of at least 8 characters.' });
  const { role: requestedRole, ...details } = parsed.data;
  if (!BASIC_ACCOUNT_ROLES.includes(requestedRole) && !canCreatePrivilegedUsers(req.user.role)) {
    return res.status(403).json({ message: 'Only system administrators can create privileged users' });
  }
  try {
    const user = await User.create({ ...details, role: requestedRole });
    try {
      if (requestedRole === 'student') {
        await StudentProfile.create({ userId: user._id, studentId: user.studentId, fullName: user.fullName, email: user.email });
      }
    } catch (error) {
      await User.findByIdAndDelete(user._id);
      throw error;
    }
    await audit({ actorId: req.user._id, action: 'user.created', entity: 'User', entityId: user._id, after: user.toPublicJSON() });
    return res.status(201).json({ user: user.toPublicJSON() });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'An account already exists with this email or student ID.' });
    throw error;
  }
});

router.get('/admissions', protect, authorize('student_affairs', 'department_admin', 'academic_officer', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const admissionList = await AdmissionList.findOne({ key: 'active' }).lean();
  return res.json({ records: admissionList?.records || [], importedAt: admissionList?.importedAt || null });
});

router.post('/admissions/import', protect, authorize('student_affairs', 'department_admin', 'academic_officer', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const importSchema = z.object({ csv: z.string().min(10) });
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'A valid CSV string is required.' });
  }

  try {
    const records = parseAdmissionsCsv(parsed.data.csv);
    await AdmissionList.findOneAndUpdate(
      { key: 'active' },
      { $set: { records, importedAt: new Date() } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({
      message: `Admission list imported successfully (${records.length} records).`,
      importedCount: records.length,
    });
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to import CSV file.' });
  }
});

router.post('/lecturers/import', protect, authorize('department_admin', 'academic_officer', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const parsed = z.object({ csv: z.string().min(10).max(2_000_000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'A valid lecturer CSV is required.' });

  const lines = parsed.data.csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2 || lines.length > 501) return res.status(400).json({ message: 'Provide a header and between 1 and 500 lecturer rows.' });
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[\s_-]/g, ''));
  const nameIndex = headers.findIndex((header) => ['fullname', 'name'].includes(header));
  const emailIndex = headers.indexOf('email');
  const departmentIndex = headers.indexOf('department');
  if (nameIndex < 0 || emailIndex < 0) return res.status(400).json({ message: 'CSV headers must include fullName and email. department is optional.' });

  const rows = [];
  const rowErrors = [];
  const seenEmails = new Set();
  for (let index = 1; index < lines.length; index += 1) {
    const cells = parseCsvLine(lines[index]);
    const fullName = normalizeCsvRow(cells[nameIndex]);
    const email = String(cells[emailIndex] || '').trim().toLowerCase();
    const department = departmentIndex < 0 ? '' : normalizeCsvRow(cells[departmentIndex]);
    const parsedEmail = z.string().email().safeParse(email);
    if (!fullName || !parsedEmail.success) {
      rowErrors.push({ row: index + 1, message: 'A full name and valid email are required.' });
      continue;
    }
    if (seenEmails.has(email)) {
      rowErrors.push({ row: index + 1, message: `Duplicate email in CSV: ${email}` });
      continue;
    }
    seenEmails.add(email);
    rows.push({ row: index + 1, fullName, email, department });
  }
  if (rowErrors.length) return res.status(400).json({ message: 'Fix the lecturer CSV rows and upload it again.', errors: rowErrors });

  const existingUsers = await User.find({ email: { $in: rows.map((row) => row.email) } }).select('email');
  if (existingUsers.length) {
    return res.status(409).json({
      message: 'Some email addresses already have accounts. Remove them or resolve them before importing.',
      duplicates: existingUsers.map((user) => user.email),
    });
  }

  const imported = [];
  const errors = [];
  const setupLinks = [];
  for (const row of rows) {
    const setupToken = crypto.randomBytes(32).toString('hex');
    const user = new User({
      fullName: row.fullName,
      email: row.email,
      department: row.department,
      role: 'lecturer',
      password: crypto.randomBytes(32).toString('hex'),
      resetPasswordToken: crypto.createHash('sha256').update(setupToken).digest('hex'),
      resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
    });

    try {
      await user.save();
      let emailSent = false;
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
        try {
          emailSent = await sendPasswordResetEmail({ to: user.email, token: setupToken });
        } catch (error) {
          console.error('Lecturer setup email failed:', error.message);
        }
      }
      if (!emailSent) {
        const setupUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(setupToken)}`;
        setupLinks.push({ email: user.email, url: setupUrl });
      }
      await audit({ actorId: req.user._id, action: 'lecturer.imported', entity: 'User', entityId: user._id, after: { fullName: user.fullName, email: user.email, department: user.department, role: user.role } });
      imported.push({ _id: user._id, fullName: user.fullName, email: user.email, department: user.department, role: user.role, status: user.status });
    } catch (error) {
      if (user.isNew) {
        errors.push({ row: row.row, email: row.email, message: error.code === 11000 ? 'This email already has an account.' : 'Account could not be created.' });
        continue;
      }
      errors.push({ row: row.row, email: row.email, message: 'Account was created but could not be imported cleanly.' });
    }
  }

  return res.status(errors.length ? 207 : 201).json({
    message: `${imported.length} lecturer account${imported.length === 1 ? '' : 's'} imported.`,
    created: imported.length,
    users: imported,
    setupLinks,
    errors,
  });
});

router.patch('/:id', protect, authorize('student_affairs', 'department_admin', 'academic_officer', 'system_admin', 'super_admin'), async (req, res) => {
  const updates = { ...req.body };
  delete updates.password;
  if (updates.role && (!ALL_ACCOUNT_ROLES.includes(updates.role) || (!BASIC_ACCOUNT_ROLES.includes(updates.role) && !canCreatePrivilegedUsers(req.user.role)))) {
    return res.status(403).json({ message: 'Only system administrators can assign privileged roles' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ user });
});

router.delete('/:id', protect, authorize('student_affairs', 'department_admin', 'academic_officer', 'system_admin', 'super_admin'), async (req, res) => {
  if (String(req.user._id) === req.params.id) {
    return res.status(400).json({ message: 'You cannot delete your own account' });
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ message: 'User deleted' });
});

module.exports = router;
