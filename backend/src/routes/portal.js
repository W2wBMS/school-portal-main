const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const Course = require('../models/Course');
const Attendance = require('../models/Attendance');
const FeeLedger = require('../models/FeeLedger');
const Payment = require('../models/Payment');
const Result = require('../models/Result');
const Registration = require('../models/Registration');
const Notification = require('../models/Notification');
const { audit } = require('../utils/audit');
const { calculateAcademicSummary } = require('../utils/academics');

const router = express.Router();

function gradeForScore(score) {
  if (score >= 80) return 'A';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function validScore(score) {
  return Number.isFinite(Number(score)) && Number(score) >= 0 && Number(score) <= 100;
}

function validDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function courseScheduleError(course) {
  const hasSchedule = Boolean(course.scheduleDay || course.startTime || course.endTime);
  if (!hasSchedule) return null;
  if (!course.scheduleDay || !course.startTime || !course.endTime) return 'Provide a day, start time, and end time for the timetable entry';
  if (course.startTime >= course.endTime) return 'Class end time must be later than start time';
  return null;
}

async function resolveLecturerAssignment(lecturerId) {
  if (lecturerId === null || lecturerId === '') return { lecturerId: null };
  if (!mongoose.Types.ObjectId.isValid(lecturerId)) return { error: 'Select a valid lecturer account' };
  const lecturer = await User.findOne({ _id: lecturerId, role: 'lecturer', status: 'active' }).select('_id');
  if (!lecturer) return { error: 'The selected account is not an active lecturer' };
  return { lecturerId: lecturer._id };
}

function calculateScore(components) {
  if (!components || typeof components !== 'object' || Array.isArray(components)) return null;
  let ranges = {};
  try { ranges = JSON.parse(process.env.RESULT_COMPONENT_RANGES || '{}'); } catch { return null; }
  const values = Object.entries(components).map(([name, value]) => ({ name, value: Number(value), max: Number(ranges[name] ?? 100) }));
  if (!values.length || values.some(({ value, max }) => !Number.isFinite(value) || value < 0 || value > max)) return null;
  const total = values.reduce((sum, item) => sum + item.value, 0);
  return total <= 100 ? total : null;
}

function createBlankResultApprovals() {
  return { hod: null, lecturer: null, admin: null };
}

function resultHasRequiredApprovals(result) {
  const approvals = result?.resultApprovals || createBlankResultApprovals();
  return Boolean(approvals.hod && approvals.lecturer && approvals.admin);
}

async function canEnterResult(user, courseId) {
  if (['academic_officer', 'department_admin', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'].includes(user.role)) return true;
  if (user.role !== 'lecturer') return false;
  const course = await Course.findOne({ _id: courseId, lecturerId: user._id });
  return Boolean(course);
}

async function notifyResultReview(course) {
  const reviewers = await User.find({ role: { $in: ['academic_officer', 'department_admin', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'] }, status: 'active' }).select('_id');
  if (!reviewers.length) return;
  await Notification.insertMany(reviewers.map((reviewer) => ({
    userId: reviewer._id,
    title: 'Results awaiting approval',
    message: `New results for ${course.code} — ${course.title} were submitted and need review.`,
  })));
}

function canManageAllAttendance(user) {
  return ['department_admin', 'academic_officer', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'].includes(user.role);
}

async function canManageAttendance(user, courseId) {
  if (canManageAllAttendance(user)) return true;
  if (user.role !== 'lecturer') return false;
  return Boolean(await Course.exists({ _id: courseId, lecturerId: user._id }));
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

function normalizeCsvValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
}

function pickCsvValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      return String(value).trim();
    }
  }
  return '';
}

function parseCsvRows(csv) {
  const lines = String(csv || '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => normalizeCsvValue(header));
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = cells[index] || '';
      return record;
    }, {});
  }).filter((row) => Object.values(row).some((value) => String(value).trim().length > 0));
}

router.get('/student-overview', protect, async (req, res) => {
  const profile = await StudentProfile.findOne({ userId: req.user._id });
  const results = await Result.find({ studentId: req.user._id, approved: { $ne: false } }).populate('courseId').sort({ semester: 1, createdAt: 1 });
  const attendance = await Attendance.find({ studentId: req.user._id }).populate('courseId');
  const feeLedger = await FeeLedger.find({ studentId: req.user._id }).sort({ createdAt: -1 });

  const normalizedResults = results.map((result) => ({ ...result.toObject(), level: result.level || profile?.level || '', academicYear: result.academicYear || process.env.CURRENT_ACADEMIC_YEAR || '2025/2026' }));
  const academicSummary = calculateAcademicSummary(normalizedResults);
  return res.json({
    profile: profile ? { ...profile.toObject(), cgpa: academicSummary.cgpa, creditsCompleted: academicSummary.totalCredits } : profile,
    results: normalizedResults,
    attendance,
    feeLedger,
    academicSummary,
  });
});

router.get('/courses', protect, async (req, res) => {
  const filter = req.user.role === 'lecturer' ? { lecturerId: req.user._id } : {};
  const courses = await Course.find(filter).populate('lecturerId', 'fullName email');
  return res.json({ courses });
});

router.get('/courses/:id/roster', protect, authorize('lecturer', 'department_admin', 'academic_officer', 'system_admin', 'super_admin'), async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Course not found' });
  const course = await Course.findById(req.params.id).select('code title semester lecturerId');
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (req.user.role === 'lecturer' && String(course.lecturerId) !== String(req.user._id)) return res.status(403).json({ message: 'You can only view rosters for courses assigned to you' });

  const registrations = await Registration.find({ courseIds: course._id, semester: course.semester, status: 'approved' })
    .populate('studentId', 'fullName email studentId level department programme status')
    .sort({ 'studentId.fullName': 1 });
  const students = registrations.map((registration) => registration.studentId).filter((student) => student && student.status === 'active');
  const dateKey = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
  if (!validDateKey(dateKey)) return res.status(400).json({ message: 'Date must use YYYY-MM-DD format' });
  const dateStart = new Date(`${dateKey}T00:00:00.000Z`);
  const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
  const records = await Attendance.find({ courseId: course._id, studentId: { $in: students.map((student) => student._id) }, date: { $gte: dateStart, $lt: dateEnd } });
  const attendanceByStudent = new Map(records.map((record) => [String(record.studentId), record]));
  const roster = students.map((student) => ({ student, attendance: attendanceByStudent.get(String(student._id)) || null }));
  return res.json({ course, date: dateKey, roster });
});

router.post('/courses/import', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin'), async (req, res) => {
  const csv = String(req.body.csv || '');
  const rows = parseCsvRows(csv);

  if (!rows.length) {
    return res.status(400).json({ message: 'A valid CSV with course rows is required.' });
  }

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const code = pickCsvValue(row, ['code', 'coursecode', 'course_code']);
    const title = pickCsvValue(row, ['title', 'coursetitle', 'name']);
    const credits = Number(pickCsvValue(row, ['credits', 'credit_hours', 'credit']));
    const department = pickCsvValue(row, ['department', 'school', 'faculty']) || 'General';
    const semester = pickCsvValue(row, ['semester', 'term']) || 'Semester 1';
    const scheduleDay = pickCsvValue(row, ['scheduleday', 'schedule_day', 'day']);
    const startTime = pickCsvValue(row, ['starttime', 'start_time']);
    const endTime = pickCsvValue(row, ['endtime', 'end_time']);
    const room = pickCsvValue(row, ['room', 'location']);

    if (!code || !title) continue;

    const payload = {
      code: code.toUpperCase(),
      title,
      credits: Number.isFinite(credits) && credits > 0 ? credits : 3,
      department,
      semester,
    };
    if (scheduleDay || startTime || endTime) Object.assign(payload, { scheduleDay, startTime, endTime, room });
    const scheduleError = courseScheduleError(payload);
    if (scheduleError) continue;

    const existingCourse = await Course.findOne({ code: payload.code });
    if (existingCourse) {
      await Course.findByIdAndUpdate(existingCourse._id, payload, { runValidators: true });
      updated += 1;
    } else {
      await Course.create(payload);
      created += 1;
    }
  }

  return res.json({ message: `Courses imported successfully. Created ${created}, updated ${updated}.`, created, updated });
});

router.post('/courses', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin'), async (req, res) => {
  const payload = { ...req.body };
  const scheduleError = courseScheduleError(payload);
  if (scheduleError) return res.status(400).json({ message: scheduleError });
  if (Object.hasOwn(payload, 'lecturerId')) {
    const assignment = await resolveLecturerAssignment(payload.lecturerId);
    if (assignment.error) return res.status(400).json({ message: assignment.error });
    payload.lecturerId = assignment.lecturerId;
  }
  const course = await Course.create(payload);
  await audit({ actorId: req.user._id, action: 'course.created', entity: 'Course', entityId: course._id, after: course.toObject() });
  const populated = await Course.findById(course._id).populate('lecturerId', 'fullName email');
  return res.status(201).json({ course: populated });
});

router.patch('/courses/:id', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin'), async (req, res) => {
  const current = await Course.findById(req.params.id);
  if (!current) return res.status(404).json({ message: 'Course not found' });
  const updates = { ...req.body };
  const scheduleError = courseScheduleError({ ...current.toObject(), ...updates });
  if (scheduleError) return res.status(400).json({ message: scheduleError });
  if (Object.hasOwn(updates, 'lecturerId')) {
    const assignment = await resolveLecturerAssignment(updates.lecturerId);
    if (assignment.error) return res.status(400).json({ message: assignment.error });
    updates.lecturerId = assignment.lecturerId;
  }
  const course = await Course.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate('lecturerId', 'fullName email');
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (Object.hasOwn(updates, 'lecturerId')) {
    await audit({ actorId: req.user._id, action: updates.lecturerId ? 'course.lecturer_assigned' : 'course.lecturer_unassigned', entity: 'Course', entityId: course._id, before: current.toObject(), after: course.toObject() });
    const previousLecturerId = current.lecturerId ? String(current.lecturerId) : '';
    const nextLecturerId = course.lecturerId ? String(course.lecturerId._id || course.lecturerId) : '';
    if (nextLecturerId && nextLecturerId !== previousLecturerId) {
      await Notification.create({ userId: nextLecturerId, title: 'Course assigned', message: `${course.code} — ${course.title} has been assigned to you.` });
    }
    if (previousLecturerId && previousLecturerId !== nextLecturerId) {
      await Notification.create({ userId: previousLecturerId, title: 'Course assignment updated', message: `Your assignment to ${current.code} — ${current.title} has been removed.` });
    }
  }
  if (!Object.keys(updates).every((key) => key === 'lecturerId')) {
    await audit({ actorId: req.user._id, action: 'course.updated', entity: 'Course', entityId: course._id, before: current.toObject(), after: course.toObject() });
  }
  return res.json({ course });
});

router.delete('/courses/:id', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin'), async (req, res) => {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  return res.json({ message: 'Course deleted' });
});

router.get('/attendance', protect, authorize('lecturer', 'department_admin', 'student_affairs', 'system_admin', 'super_admin', 'academic_officer', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const filter = req.user.role === 'lecturer'
    ? { courseId: { $in: await Course.find({ lecturerId: req.user._id }).distinct('_id') } }
    : {};
  const attendance = await Attendance.find(filter).populate('studentId', 'fullName email').populate('courseId', 'code title');
  return res.json({ attendance });
});

router.post('/attendance/session', protect, authorize('lecturer', 'department_admin', 'academic_officer', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const { courseId, date, records } = req.body;
  if (!mongoose.Types.ObjectId.isValid(courseId) || !validDateKey(date) || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: 'Course, valid date, and attendance records are required' });
  }
  if (!(await canManageAttendance(req.user, courseId))) return res.status(403).json({ message: 'You are not authorized to manage this course attendance' });
  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (records.some((record) => !record || typeof record !== 'object' || !mongoose.Types.ObjectId.isValid(record.studentId) || !['present', 'absent', 'late'].includes(record.status))) {
    return res.status(400).json({ message: 'Each student must appear once with present, absent, or late status' });
  }
  const uniqueIds = records.map((record) => String(record.studentId));
  if (new Set(uniqueIds).size !== uniqueIds.length) return res.status(400).json({ message: 'Each student can only appear once per attendance session' });
  const registeredIds = await Registration.find({ courseIds: course._id, semester: course.semester, status: 'approved', studentId: { $in: uniqueIds } }).distinct('studentId');
  if (registeredIds.length !== uniqueIds.length) return res.status(422).json({ message: 'Attendance can only be recorded for students on the approved course roster' });

  const sessionDate = new Date(`${date}T00:00:00.000Z`);
  const sessionDateEnd = new Date(sessionDate.getTime() + 24 * 60 * 60 * 1000);
  const saved = [];
  for (const record of records) {
    const present = record.status !== 'absent';
    const attendance = await Attendance.findOneAndUpdate(
      { courseId: course._id, studentId: record.studentId, date: { $gte: sessionDate, $lt: sessionDateEnd } },
      { $set: { status: record.status, date: sessionDate, presentCount: present ? 1 : 0, totalClasses: 1, percentage: present ? 100 : 0 } },
      { new: true, upsert: true, runValidators: true }
    );
    saved.push(attendance);
  }
  await audit({ actorId: req.user._id, action: 'attendance.session_recorded', entity: 'Course', entityId: course._id, metadata: { date, recordCount: saved.length } });
  return res.json({ course, date, attendance: saved });
});

router.post('/attendance', protect, authorize('lecturer', 'department_admin', 'academic_officer', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const percentage = Number(req.body.percentage);
  if (!req.body.studentId || !req.body.courseId || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return res.status(400).json({ message: 'Student, course, and a percentage from 0 to 100 are required' });
  }
  if (!(await canManageAttendance(req.user, req.body.courseId))) return res.status(403).json({ message: 'You are not authorized to manage this course attendance' });
  if (req.user.role === 'lecturer' && !(await Registration.exists({ studentId: req.body.studentId, courseIds: req.body.courseId, status: 'approved' }))) {
    return res.status(422).json({ message: 'Attendance can only be recorded for students on the approved course roster' });
  }
  const attendance = await Attendance.create({ ...req.body, percentage });
  return res.status(201).json({ attendance });
});

router.patch('/attendance/:id', protect, authorize('lecturer', 'department_admin', 'academic_officer', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const current = await Attendance.findById(req.params.id);
  if (!current) return res.status(404).json({ message: 'Attendance record not found' });
  if (!(await canManageAttendance(req.user, current.courseId))) return res.status(403).json({ message: 'You are not authorized to manage this course attendance' });
  if (req.user.role === 'lecturer' && !(await Registration.exists({ studentId: current.studentId, courseIds: current.courseId, status: 'approved' }))) {
    return res.status(422).json({ message: 'Attendance can only be updated for students on the approved course roster' });
  }
  if (req.body.percentage !== undefined && (!Number.isFinite(Number(req.body.percentage)) || Number(req.body.percentage) < 0 || Number(req.body.percentage) > 100)) {
    return res.status(400).json({ message: 'Percentage must be from 0 to 100' });
  }
  const attendance = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!attendance) return res.status(404).json({ message: 'Attendance record not found' });
  return res.json({ attendance });
});

router.delete('/attendance/:id', protect, authorize('department_admin', 'student_affairs', 'academic_officer', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const attendance = await Attendance.findByIdAndDelete(req.params.id);
  if (!attendance) return res.status(404).json({ message: 'Attendance record not found' });
  return res.json({ message: 'Attendance record deleted' });
});

router.get('/fees', protect, authorize('finance_officer', 'department_admin', 'system_admin', 'super_admin', 'student', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const filter = req.user.role === 'student' ? { studentId: req.user._id } : {};
  const fees = await FeeLedger.find(filter).populate('studentId', 'fullName email');
  return res.json({ fees });
});

router.get('/results', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin', 'lecturer', 'student', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const filter = req.user.role === 'student'
    ? { studentId: req.user._id, approved: { $ne: false } }
    : req.user.role === 'lecturer'
      ? { courseId: { $in: await Course.find({ lecturerId: req.user._id }).distinct('_id') } }
      : {};
  const results = await Result.find(filter)
    .populate('studentId', 'fullName email')
    .populate('courseId', 'code title credits')
    .populate('resultApprovals.hod', 'fullName role')
    .populate('resultApprovals.lecturer', 'fullName role')
    .populate('resultApprovals.admin', 'fullName role')
    .sort({ semester: 1, createdAt: 1 });
  return res.json({ results });
});

router.post('/results/import', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin', 'lecturer', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const csv = String(req.body.csv || '');
  const rows = parseCsvRows(csv);

  if (!rows.length) {
    return res.status(400).json({ message: 'A valid CSV with result rows is required.' });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const notifiedCourses = new Set();

  for (const row of rows) {
    const studentId = pickCsvValue(row, ['studentid', 'student_id', 'student']);
    const fullName = pickCsvValue(row, ['fullname', 'studentname', 'name']);
    const email = pickCsvValue(row, ['email', 'studentemail']);
    const courseCode = pickCsvValue(row, ['coursecode', 'course_code', 'code', 'course']);
    const score = Number(pickCsvValue(row, ['score', 'marks', 'total']));
    const level = pickCsvValue(row, ['level', 'studentlevel']) || '';
    const semester = pickCsvValue(row, ['semester', 'term']) || 'Semester 1';
    const academicYear = pickCsvValue(row, ['academicyear', 'academic_year', 'year']) || process.env.CURRENT_ACADEMIC_YEAR || '2025/2026';

    if (!courseCode || !Number.isFinite(score) || (!studentId && !fullName && !email)) {
      skipped += 1;
      continue;
    }

    const course = await Course.findOne({ code: new RegExp(`^${courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (!course || !(await canEnterResult(req.user, course._id))) {
      skipped += 1;
      continue;
    }

    let student = null;
    if (studentId) {
      student = await User.findOne({ studentId: String(studentId).trim() });
    }
    if (!student && fullName) {
      student = await User.findOne({ fullName: new RegExp(`^${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    }
    if (!student && email) {
      student = await User.findOne({ email: String(email).trim().toLowerCase() });
    }
    if (!student) {
      skipped += 1;
      continue;
    }

    if (req.user.role === 'lecturer' && !(await Registration.exists({ studentId: student._id, courseIds: course._id, semester: course.semester, status: 'approved' }))) {
      skipped += 1;
      continue;
    }

    const normalizedLevel = level || student.level || '';
    const resultScore = Math.min(Math.max(score, 0), 100);
    const payload = {
      studentId: student._id,
      courseId: course._id,
      score: resultScore,
      grade: gradeForScore(resultScore),
      semester,
      level: normalizedLevel,
      academicYear,
      approved: false,
      finalized: false,
      approvedBy: null,
      approvedAt: null,
      resultApprovals: createBlankResultApprovals(),
    };

    const existing = await Result.findOne({
      studentId: student._id,
      courseId: course._id,
      semester,
      level: normalizedLevel,
      academicYear,
    });

    if (existing?.finalized && req.user.role === 'lecturer') {
      skipped += 1;
      continue;
    }
    let savedResult;
    if (existing) {
      savedResult = await Result.findByIdAndUpdate(existing._id, payload, { new: true, runValidators: true });
      updated += 1;
    } else {
      savedResult = await Result.create(payload);
      created += 1;
    }
    await audit({ actorId: req.user._id, action: req.user.role === 'lecturer' ? 'result.submitted' : 'result.imported', entity: 'Result', entityId: savedResult._id, before: existing?.toObject(), after: savedResult.toObject() });
    if (req.user.role === 'lecturer' && !notifiedCourses.has(String(course._id))) {
      await notifyResultReview(course);
      notifiedCourses.add(String(course._id));
    }
  }

  return res.json({
    message: `Results imported successfully. Created ${created}, updated ${updated}, skipped ${skipped}.`,
    created,
    updated,
    skipped,
  });
});

router.post('/results', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin', 'lecturer', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const { studentId, courseId, score, scoreComponents, semester = 'Semester 1', level, academicYear = process.env.CURRENT_ACADEMIC_YEAR || '2025/2026' } = req.body;
  const calculatedScore = scoreComponents ? calculateScore(scoreComponents) : Number(score);
  if (!studentId || !courseId || !validScore(calculatedScore)) return res.status(400).json({ message: 'Student, course, and valid score components are required' });
  if (!(await canEnterResult(req.user, courseId))) return res.status(403).json({ message: 'You are not authorized to enter results for this course' });
  const student = await User.findById(studentId).select('level status role');
  if (!student) return res.status(404).json({ message: 'Student not found' });
  if (student.role !== 'student' || student.status !== 'active') return res.status(422).json({ message: 'Results can only be entered for active student accounts' });
  const course = await Course.findById(courseId).select('semester code title');
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (req.user.role === 'lecturer' && !(await Registration.exists({ studentId, courseIds: courseId, semester: course.semester, status: 'approved' }))) {
    return res.status(422).json({ message: 'The student is not on the approved roster for this course' });
  }
  const resultLevel = level || student.level || '';
  const duplicate = await Result.exists({ studentId, courseId, semester, level: resultLevel, academicYear });
  if (duplicate) return res.status(409).json({ message: 'A result already exists for this student, course, and semester' });
  const isLecturer = req.user.role === 'lecturer';
  const result = await Result.create({ studentId, courseId, score: calculatedScore, scoreComponents: scoreComponents || {}, grade: gradeForScore(calculatedScore), semester, level: resultLevel, academicYear, approved: false, finalized: false, approvedBy: null, approvedAt: null, resultApprovals: createBlankResultApprovals() });
  await audit({ actorId: req.user._id, action: 'result.submitted', entity: 'Result', entityId: result._id, after: result.toObject() });
  if (isLecturer) {
    await notifyResultReview(course);
  }
  const populated = await Result.findById(result._id)
    .populate('studentId', 'fullName email')
    .populate('courseId', 'code title credits');
  return res.status(201).json({ result: populated });
});

router.patch('/results/:id', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin', 'lecturer', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const current = await Result.findById(req.params.id);
  if (!current) return res.status(404).json({ message: 'Result record not found' });
  if (current.finalized) return res.status(409).json({ message: 'Finalized grades require the correction workflow' });
  if (!(await canEnterResult(req.user, current.courseId))) return res.status(403).json({ message: 'You are not authorized to update this result' });
  const calculatedScore = req.body.scoreComponents ? calculateScore(req.body.scoreComponents) : Number(req.body.score);
  if (!validScore(calculatedScore)) return res.status(400).json({ message: 'Score or score components must be within configured ranges' });
  const result = await Result.findByIdAndUpdate(req.params.id, { score: calculatedScore, scoreComponents: req.body.scoreComponents || current.scoreComponents, grade: gradeForScore(calculatedScore), approved: false, finalized: false, resultApprovals: createBlankResultApprovals(), approvedBy: null, approvedAt: null }, { new: true, runValidators: true });
  if (!result) return res.status(404).json({ message: 'Result record not found' });
  await audit({ actorId: req.user._id, action: 'result.updated', entity: 'Result', entityId: result._id, before: current.toObject(), after: result.toObject() });
  const populated = await Result.findById(result._id)
    .populate('studentId', 'fullName email')
    .populate('courseId', 'code title credits');
  return res.json({ result: populated });
});

router.post('/results/:id/approve', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc', 'lecturer'), async (req, res) => {
  const current = await Result.findById(req.params.id);
  if (!current) return res.status(404).json({ message: 'Result record not found' });
  if (current.finalized) return res.status(409).json({ message: 'This result has already been finalized' });

  const course = await Course.findById(current.courseId).select('code title lecturerId');
  const approvalType = String(req.body.approvalType || '').toLowerCase();
  const isCourseLecturer = String(course?.lecturerId || '') === String(req.user._id);
  const isHodApprover = ['hod', 'pro_vc', 'vc'].includes(req.user.role);
  const isAdminApprover = ['department_admin', 'academic_officer', 'finance_officer', 'student_affairs', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'].includes(req.user.role);

  let requestedType = approvalType;
  if (!requestedType) {
    if (isCourseLecturer) requestedType = 'lecturer';
    else if (isHodApprover) requestedType = 'hod';
    else if (isAdminApprover) requestedType = 'admin';
  }

  if (!['hod', 'lecturer', 'admin'].includes(requestedType)) {
    return res.status(400).json({ message: 'Specify an approval type of hod, lecturer, or admin.' });
  }
  if (requestedType === 'lecturer' && !isCourseLecturer) {
    return res.status(403).json({ message: 'Only the assigned lecturer can confirm the lecturer approval step.' });
  }
  if (requestedType === 'hod' && !isHodApprover) {
    return res.status(403).json({ message: 'Only the HOD or higher can confirm the HOD approval step.' });
  }
  if (requestedType === 'admin' && !isAdminApprover) {
    return res.status(403).json({ message: 'Only an administrator can confirm the admin approval step.' });
  }

  const approvals = current.resultApprovals || createBlankResultApprovals();
  approvals[requestedType] = req.user._id;
  const complete = resultHasRequiredApprovals({ resultApprovals: approvals });
  const result = await Result.findByIdAndUpdate(req.params.id, {
    resultApprovals: approvals,
    approved: complete,
    finalized: complete,
    approvedBy: req.user._id,
    approvedAt: new Date(),
  }, { new: true });

  await audit({ actorId: req.user._id, action: 'result.approved', entity: 'Result', entityId: result._id, before: current.toObject(), after: result.toObject(), metadata: { approvalType: requestedType, complete } });

  if (complete) {
    const recipients = [result.studentId, course?.lecturerId].filter(Boolean).map(String);
    await Notification.insertMany([...new Set(recipients)].map((userId) => ({
      userId,
      title: 'Result approved',
      message: `${course?.code || 'A course'} result for ${result.semester} has been approved and published.`,
    })));
  }

  const populated = await Result.findById(result._id)
    .populate('studentId', 'fullName email')
    .populate('courseId', 'code title credits')
    .populate('resultApprovals.hod', 'fullName role')
    .populate('resultApprovals.lecturer', 'fullName role')
    .populate('resultApprovals.admin', 'fullName role');
  return res.json({ result: populated, complete });
});

router.post('/results/:id/correct', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc', 'lecturer'), async (req, res) => {
  const current = await Result.findById(req.params.id);
  if (!current) return res.status(404).json({ message: 'Result record not found' });
  if (!current.finalized) return res.status(409).json({ message: 'Use the normal result update workflow before finalization' });
  if (!(await canEnterResult(req.user, current.courseId))) return res.status(403).json({ message: 'You are not authorized to correct this result' });
  if (!String(req.body.reason || '').trim() || !validScore(req.body.score)) return res.status(400).json({ message: 'Correction reason and score from 0 to 100 are required' });
  const result = await Result.findByIdAndUpdate(req.params.id, { score: Number(req.body.score), grade: gradeForScore(Number(req.body.score)), approved: false, finalized: false, correctionReason: req.body.reason, approvedBy: null, approvedAt: null, resultApprovals: createBlankResultApprovals() }, { new: true, runValidators: true });
  await audit({ actorId: req.user._id, action: 'result.corrected', entity: 'Result', entityId: result._id, before: current.toObject(), after: result.toObject(), metadata: { reason: req.body.reason } });
  const populated = await Result.findById(result._id)
    .populate('studentId', 'fullName email')
    .populate('courseId', 'code title credits');
  return res.json({ result: populated });
});

router.delete('/results/:id', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const existing = await Result.findById(req.params.id);
  if (existing?.finalized) return res.status(409).json({ message: 'Finalized grades require the correction workflow' });
  const result = await Result.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ message: 'Result record not found' });
  return res.json({ message: 'Result deleted' });
});

router.post('/fees', protect, authorize('finance_officer', 'department_admin', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const amountDue = Number(req.body.amountDue);
  const amountPaid = Number(req.body.amountPaid || 0);
  if (!req.body.studentId || !req.body.invoiceNumber || !Number.isFinite(amountDue) || amountDue < 0 || !Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > amountDue) {
    return res.status(400).json({ message: 'Valid student, invoice, amount due, and amount paid are required' });
  }
  const balance = amountDue - amountPaid;
  const fee = await FeeLedger.create({ ...req.body, amountDue, amountPaid, balance, status: balance === 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid' });
  await audit({ actorId: req.user._id, action: 'fee.created', entity: 'FeeLedger', entityId: fee._id, after: fee.toObject() });
  return res.status(201).json({ fee });
});

router.patch('/fees/:id', protect, authorize('finance_officer', 'department_admin', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const current = await FeeLedger.findById(req.params.id);
  if (!current) return res.status(404).json({ message: 'Fee record not found' });
  const updates = { ...req.body };
  if (updates.amountDue !== undefined || updates.amountPaid !== undefined) {
    const amountDue = Number(updates.amountDue ?? current.amountDue);
    const amountPaid = Number(updates.amountPaid ?? current.amountPaid);
    if (!Number.isFinite(amountDue) || amountDue < 0 || !Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > amountDue) {
      return res.status(400).json({ message: 'Amount paid must be between zero and amount due' });
    }
    updates.amountDue = amountDue;
    updates.amountPaid = amountPaid;
    updates.balance = amountDue - amountPaid;
    updates.status = updates.balance === 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';
  }
  const fee = await FeeLedger.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!fee) return res.status(404).json({ message: 'Fee record not found' });
  await audit({ actorId: req.user._id, action: 'fee.updated', entity: 'FeeLedger', entityId: fee._id, before: current.toObject(), after: fee.toObject() });
  return res.json({ fee });
});

router.delete('/fees/:id', protect, authorize('finance_officer', 'department_admin', 'system_admin', 'super_admin', 'hod', 'pro_vc', 'vc'), async (req, res) => {
  const fee = await FeeLedger.findById(req.params.id);
  if (!fee) return res.status(404).json({ message: 'Fee record not found' });
  if (await Payment.exists({ feeLedgerId: fee._id, status: 'successful' })) return res.status(409).json({ message: 'Invoices with verified payments cannot be deleted' });
  await FeeLedger.deleteOne({ _id: fee._id });
  await audit({ actorId: req.user._id, action: 'fee.deleted', entity: 'FeeLedger', entityId: fee._id, before: fee.toObject() });
  return res.json({ message: 'Fee record deleted' });
});

module.exports = router;
