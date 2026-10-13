const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Course = require('../models/Course');
const Result = require('../models/Result');
const FeeLedger = require('../models/FeeLedger');
const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const StudentRequest = require('../models/StudentRequest');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { calculateAcademicSummary } = require('../utils/academics');
const { z } = require('zod');
const { sendPasswordResetEmail } = require('../utils/mail');

const router = express.Router();
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many password reset attempts. Try again later.' } });
const resetRequestSchema = z.object({ email: z.string().trim().email() });
const resetPasswordSchema = z.object({ token: z.string().min(32).max(128), password: z.string().min(8).max(128) });
const currentSemester = () => process.env.CURRENT_SEMESTER || 'Semester 1';
const maxCredits = () => Number(process.env.MAX_REGISTRATION_CREDITS || 24);

function registrationWindowOpen() {
  const now = Date.now();
  const starts = process.env.REGISTRATION_START ? Date.parse(process.env.REGISTRATION_START) : Number.NEGATIVE_INFINITY;
  const ends = process.env.REGISTRATION_END ? Date.parse(process.env.REGISTRATION_END) : Number.POSITIVE_INFINITY;
  return now >= starts && now <= ends;
}

async function validateRegistration(user, semester, courseIds) {
  const profile = await StudentProfile.findOne({ userId: user._id });
  if (user.role !== 'student') return 'Only students can register courses';
  if (user.status !== 'active' || !profile || !['active', 'registered'].includes(profile.status)) return 'Student must have active academic status';
  if (!registrationWindowOpen()) return 'Registration is outside the configured registration window';
  if (!Array.isArray(courseIds) || courseIds.length === 0) return 'At least one course is required';
  if (new Set(courseIds.map(String)).size !== courseIds.length) return 'Duplicate course registration is prohibited';

  const courses = await Course.find({ _id: { $in: courseIds }, isActive: { $ne: false } });
  if (courses.length !== courseIds.length) return 'One or more courses are invalid or unavailable';
  const completed = new Set((await Result.find({ studentId: user._id, approved: { $ne: false } })).map((result) => String(result.courseId)));
  let credits = 0;
  for (const course of courses) {
    if (course.semester !== semester) return `${course.code} is not offered in ${semester}`;
    if (course.programmes?.length && !course.programmes.includes(profile.programme)) return `${course.code} is not available to your programme`;
    if (course.levels?.length && !course.levels.includes(profile.level)) return `${course.code} is not available to your level`;
    if (course.prerequisiteCourseIds?.some((id) => !completed.has(String(id)))) return `${course.code} prerequisites are not satisfied`;
    credits += course.credits;
  }
  if (credits > maxCredits()) return `Registration cannot exceed ${maxCredits()} credits`;
  return null;
}

router.post('/auth/forgot-password', resetLimiter, async (req, res) => {
  const response = { message: 'If an account exists, password reset instructions have been sent.' };
  const parsed = resetRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.json(response);
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (!user) return res.json(response);

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
  await audit({ actorId: user._id, action: 'auth.password_reset_requested', entity: 'User', entityId: user._id });
  try {
    await sendPasswordResetEmail({ to: user.email, token: resetToken });
  } catch (error) {
    console.error('Password reset email failed:', error.message);
  }

  return res.json(response);
});

router.post('/auth/reset-password', resetLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'A valid reset token and password of at least 8 characters are required' });
  const { token, password } = parsed.data;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({ resetPasswordToken: tokenHash, resetPasswordExpires: { $gt: new Date() } });
  if (!user) return res.status(400).json({ message: 'Reset token is invalid or expired' });

  user.password = password;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  user.sessionVersion += 1;
  await user.save();
  await audit({ actorId: user._id, action: 'auth.password_reset_completed', entity: 'User', entityId: user._id });
  return res.json({ message: 'Password reset successfully' });
});

router.get('/students/me', protect, authorize('student'), async (req, res) => {
  const profile = await StudentProfile.findOne({ userId: req.user._id });
  return res.json({ profile: profile || req.user });
});

router.put('/students/me', protect, authorize('student'), async (req, res) => {
  const allowed = ['fullName', 'programme', 'department', 'level', 'hallResidence'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const userUpdates = Object.fromEntries(Object.entries(updates).filter(([key]) => key !== 'hallResidence'));
  const user = await User.findByIdAndUpdate(req.user._id, userUpdates, { new: true, runValidators: true }).select('-password');
  const profile = await StudentProfile.findOneAndUpdate({ userId: req.user._id }, updates, { new: true, runValidators: true });
  return res.json({ profile: profile || user });
});

router.get('/students/me/courses', protect, authorize('student'), async (req, res) => {
  const courses = await Course.find({ department: req.user.department || undefined }).sort({ code: 1 });
  return res.json({ courses });
});

router.get('/students/me/results', protect, authorize('student'), async (req, res) => {
  const results = await Result.find({ studentId: req.user._id, approved: { $ne: false } }).populate('courseId', 'code title credits').sort({ semester: 1 });
  return res.json({ results });
});

router.get('/students/me/transcript', protect, authorize('student'), async (req, res) => {
  const results = await Result.find({ studentId: req.user._id, approved: { $ne: false } }).populate('courseId', 'code title credits').sort({ semester: 1, createdAt: 1 });
  const profile = await StudentProfile.findOne({ userId: req.user._id });
  const normalizedResults = results.map((result) => ({ ...result.toObject(), level: result.level || profile?.level || '', academicYear: result.academicYear || process.env.CURRENT_ACADEMIC_YEAR || '2025/2026' }));
  return res.json({ student: req.user, results: normalizedResults, academicSummary: calculateAcademicSummary(normalizedResults) });
});

router.get('/timetable', protect, authorize('student', 'lecturer', 'department_admin', 'academic_officer', 'system_admin', 'super_admin'), async (req, res) => {
  let courses;
  if (req.user.role === 'lecturer') {
    courses = await Course.find({ lecturerId: req.user._id, isActive: { $ne: false } }).populate('lecturerId', 'fullName');
  } else if (req.user.role === 'student') {
    const registration = await Registration.findOne({ studentId: req.user._id, semester: currentSemester(), status: 'approved' });
    courses = registration
      ? await Course.find({ _id: { $in: registration.courseIds }, isActive: { $ne: false } }).populate('lecturerId', 'fullName')
      : [];
  } else {
    courses = await Course.find({ isActive: { $ne: false } }).populate('lecturerId', 'fullName');
  }
  return res.json({ semester: currentSemester(), courses });
});

router.get('/registrations/current', protect, authorize('student'), async (req, res) => {
  const registration = await Registration.findOne({ studentId: req.user._id, semester: currentSemester() }).populate('courseIds');
  return res.json({ registration });
});

router.get('/registrations', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin'), async (req, res) => {
  const registrations = await Registration.find({ status: { $in: ['submitted', 'approved'] } })
    .populate('studentId', 'fullName email studentId')
    .populate('courseIds', 'code title credits')
    .sort({ submittedAt: -1, createdAt: -1 });
  return res.json({ registrations });
});

router.post('/registrations', protect, authorize('student'), async (req, res) => {
  const semester = req.body.semester || currentSemester();
  const existing = await Registration.findOne({ studentId: req.user._id, semester });
  if (existing && ['submitted', 'approved'].includes(existing.status)) return res.status(409).json({ message: 'Submitted or approved registrations cannot be changed' });
  const validationError = await validateRegistration(req.user, semester, req.body.courseIds || []);
  if (validationError) return res.status(422).json({ message: validationError });
  const registration = await Registration.findOneAndUpdate(
    { studentId: req.user._id, semester },
    { $setOnInsert: { studentId: req.user._id, semester }, $set: { courseIds: req.body.courseIds, status: 'draft' } },
    { new: true, upsert: true, runValidators: true }
  ).populate('courseIds');
  await audit({ actorId: req.user._id, action: 'registration.draft_saved', entity: 'Registration', entityId: registration._id, after: registration.toObject() });
  return res.status(201).json({ registration });
});

router.put('/registrations/:id', protect, authorize('student'), async (req, res) => {
  const existing = await Registration.findOne({ _id: req.params.id, studentId: req.user._id });
  if (!existing) return res.status(404).json({ message: 'Registration draft not found' });
  if (existing.status !== 'draft') return res.status(409).json({ message: 'Submitted or approved registrations cannot be changed' });
  const validationError = await validateRegistration(req.user, existing.semester, req.body.courseIds || []);
  if (validationError) return res.status(422).json({ message: validationError });
  const registration = await Registration.findOneAndUpdate(
    { _id: req.params.id, studentId: req.user._id, status: 'draft' },
    { courseIds: req.body.courseIds || [] },
    { new: true, runValidators: true }
  ).populate('courseIds');
  if (!registration) return res.status(404).json({ message: 'Registration draft not found' });
  await audit({ actorId: req.user._id, action: 'registration.draft_updated', entity: 'Registration', entityId: registration._id, before: existing.toObject(), after: registration.toObject() });
  return res.json({ registration });
});

router.post('/registrations/:id/submit', protect, authorize('student'), async (req, res) => {
  const registration = await Registration.findOneAndUpdate(
    { _id: req.params.id, studentId: req.user._id, status: 'draft' },
    { status: 'submitted', submittedAt: new Date() },
    { new: true }
  ).populate('courseIds');
  if (!registration) return res.status(404).json({ message: 'Registration draft not found' });
  await audit({ actorId: req.user._id, action: 'registration.submitted', entity: 'Registration', entityId: registration._id, after: registration.toObject() });
  return res.json({ registration });
});

router.post('/registrations/:id/approve', protect, authorize('academic_officer', 'department_admin', 'system_admin', 'super_admin'), async (req, res) => {
  const registration = await Registration.findOneAndUpdate(
    { _id: req.params.id, status: 'submitted' },
    { status: 'approved', approvedAt: new Date(), lockedAt: new Date() },
    { new: true }
  ).populate('courseIds');
  if (!registration) return res.status(404).json({ message: 'Submitted registration not found' });
  await audit({ actorId: req.user._id, action: 'registration.approved_and_locked', entity: 'Registration', entityId: registration._id, after: registration.toObject() });
  return res.json({ registration });
});

router.get('/fees', protect, authorize('student'), async (req, res) => {
  const fees = await FeeLedger.find({ studentId: req.user._id }).sort({ createdAt: -1 });
  return res.json({ fees });
});

router.get('/payments', protect, authorize('student'), async (req, res) => {
  const payments = await Payment.find({ studentId: req.user._id }).populate('feeLedgerId', 'invoiceNumber semester').sort({ createdAt: -1 });
  return res.json({ payments });
});

router.get('/payments/review', protect, authorize('finance_officer', 'department_admin', 'system_admin', 'super_admin'), async (req, res) => {
  const payments = await Payment.find().populate('studentId', 'fullName email studentId').populate('feeLedgerId', 'invoiceNumber semester amountDue amountPaid balance').sort({ createdAt: -1 });
  return res.json({ payments });
});

router.post('/payments/initialize', protect, authorize('student'), async (req, res) => {
  const amount = Number(req.body.amount);
  const { feeLedgerId, idempotencyKey, studentReference, paymentMethod } = req.body;
  if (!mongoose.Types.ObjectId.isValid(feeLedgerId) || !Number.isFinite(amount) || amount <= 0 || typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 128 || typeof studentReference !== 'string' || !studentReference.trim() || studentReference.length > 100 || !['bank_transfer', 'mobile_money', 'cash'].includes(paymentMethod)) {
    return res.status(400).json({ message: 'A valid invoice, amount, payment method, transaction reference, and request key are required' });
  }
  const requestKey = idempotencyKey.trim();
  const existing = await Payment.findOne({ studentId: req.user._id, idempotencyKey: requestKey });
  if (existing) return res.json({ payment: existing, reference: existing.reference, reused: true });
  const fee = await FeeLedger.findOne({ _id: feeLedgerId, studentId: req.user._id });
  if (!fee) return res.status(404).json({ message: 'Fee invoice not found' });
  if (fee.balance <= 0) return res.status(409).json({ message: 'This invoice has no outstanding balance' });
  if (amount > fee.balance) return res.status(400).json({ message: 'Payment amount cannot exceed this invoice balance' });
  const reference = `BCC-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  let payment;
  try {
    payment = await Payment.create({ studentId: req.user._id, feeLedgerId: fee._id, idempotencyKey: requestKey, studentReference: studentReference.trim(), paymentMethod, reference, amount, purpose: 'fees', gateway: 'manual' });
  } catch (error) {
    if (error.code !== 11000) throw error;
    payment = await Payment.findOne({ studentId: req.user._id, idempotencyKey: requestKey });
    if (!payment && error.keyPattern?.studentReference) return res.status(409).json({ message: 'This transaction or receipt reference has already been submitted' });
    if (!payment) throw error;
    return res.json({ payment, reference: payment.reference, reused: true });
  }
  await audit({ actorId: req.user._id, action: 'payment.initialized', entity: 'Payment', entityId: payment._id, after: payment.toObject() });
  return res.status(201).json({ payment, reference });
});

router.post('/payments/:reference/verify', protect, authorize('finance_officer', 'department_admin', 'system_admin', 'super_admin'), async (req, res) => {
  const decision = req.body.decision;
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ message: 'Choose approve or reject' });
  if (note.length > 500) return res.status(400).json({ message: 'The staff note cannot exceed 500 characters' });
  if (decision === 'reject' && !note) return res.status(400).json({ message: 'A reason is required when rejecting a payment' });

  const current = await Payment.findOne({ reference: req.params.reference });
  if (!current) return res.status(404).json({ message: 'Payment not found' });
  if (current.status !== 'pending') return res.status(409).json({ message: 'Only pending payments can be reviewed' });

  const status = decision === 'approve' ? 'successful' : 'failed';
  if (decision === 'approve') {
    const fee = current.feeLedgerId
      ? await FeeLedger.findOne({ _id: current.feeLedgerId, studentId: current.studentId, balance: { $gte: current.amount } })
      : null;
    if (!fee) return res.status(409).json({ message: 'The linked invoice no longer has enough balance for this payment' });
    const feeBefore = fee.toObject();

    const payment = await Payment.findOneAndUpdate(
      { _id: current._id, status: 'pending' },
      { status, creditedAt: new Date(), verifiedBy: req.user._id, verificationNote: note },
      { new: true }
    );
    if (!payment) return res.status(409).json({ message: 'Payment was already reviewed' });

    const updatedFee = await FeeLedger.findOneAndUpdate(
      { _id: fee._id, studentId: current.studentId, balance: { $gte: current.amount } },
      { $inc: { amountPaid: current.amount, balance: -current.amount } },
      { new: true }
    );
    if (!updatedFee) {
      await Payment.findOneAndUpdate({ _id: payment._id, status, creditedAt: payment.creditedAt }, { status: 'pending', $unset: { creditedAt: 1, verifiedBy: 1, verificationNote: 1 } });
      return res.status(409).json({ message: 'Invoice balance changed while reviewing; refresh and try again' });
    }
    updatedFee.status = updatedFee.balance === 0 ? 'paid' : 'partial';
    await updatedFee.save();
    await Notification.create({ userId: payment.studentId, title: 'Payment verified', message: `Payment ${payment.reference} for GH¢ ${payment.amount.toFixed(2)} has been verified and applied to invoice ${updatedFee.invoiceNumber}.` });
    await audit({ actorId: req.user._id, action: 'payment.verified', entity: 'Payment', entityId: payment._id, before: current.toObject(), after: payment.toObject(), metadata: { feeLedgerId: updatedFee._id } });
    await audit({ actorId: req.user._id, action: 'fee.payment_credited', entity: 'FeeLedger', entityId: updatedFee._id, before: feeBefore, after: updatedFee.toObject(), metadata: { paymentId: payment._id } });
    return res.json({ payment, fee: updatedFee });
  }

  const payment = await Payment.findOneAndUpdate(
    { _id: current._id, status: 'pending' },
    { status, verifiedBy: req.user._id, verificationNote: note },
    { new: true }
  );
  if (!payment) return res.status(409).json({ message: 'Payment was already reviewed' });
  await Notification.create({ userId: payment.studentId, title: 'Payment not approved', message: `Payment ${payment.reference} was not approved: ${note}` });
  await audit({ actorId: req.user._id, action: 'payment.rejected', entity: 'Payment', entityId: payment._id, before: current.toObject(), after: payment.toObject() });
  return res.json({ payment });
});

router.get('/payments/:reference', protect, authorize('student'), async (req, res) => {
  const payment = await Payment.findOne({ reference: req.params.reference, studentId: req.user._id });
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  return res.json({ payment });
});

router.post('/payments/:reference/refund', protect, authorize('finance_officer', 'department_admin', 'system_admin', 'super_admin'), async (req, res) => {
  const current = await Payment.findOne({ reference: req.params.reference });
  if (!current) return res.status(404).json({ message: 'Payment not found' });
  if (current.status !== 'successful' || !current.creditedAt) return res.status(409).json({ message: 'Only credited successful payments can be refunded' });
  const fee = current.feeLedgerId
    ? await FeeLedger.findOne({ _id: current.feeLedgerId, studentId: current.studentId, amountPaid: { $gte: current.amount } })
    : await FeeLedger.findOne({ studentId: current.studentId, amountPaid: { $gte: current.amount } }).sort({ createdAt: -1 });
  if (!fee) return res.status(409).json({ message: 'The linked invoice cannot be adjusted for this refund' });
  const feeBefore = fee.toObject();
  const payment = await Payment.findOneAndUpdate({ _id: current._id, status: 'successful' }, { status: 'refunded' }, { new: true });
  if (!payment) return res.status(409).json({ message: 'Payment has already changed state' });
  fee.amountPaid = Math.max(Number(fee.amountPaid) - payment.amount, 0);
  fee.balance = Math.min(Number(fee.amountDue), Number(fee.balance) + payment.amount);
  fee.status = fee.balance === 0 ? 'paid' : fee.amountPaid > 0 ? 'partial' : 'unpaid';
  await fee.save();
  await Notification.create({ userId: payment.studentId, title: 'Payment refunded', message: `Payment ${payment.reference} was refunded and GH¢ ${payment.amount.toFixed(2)} was returned to invoice ${fee.invoiceNumber}.` });
  await audit({ actorId: req.user._id, action: 'payment.refunded', entity: 'Payment', entityId: payment._id, before: current.toObject(), after: payment.toObject() });
  await audit({ actorId: req.user._id, action: 'fee.payment_refunded', entity: 'FeeLedger', entityId: fee._id, before: feeBefore, after: fee.toObject(), metadata: { paymentId: payment._id } });
  return res.json({ payment });
});

router.post('/payments/webhook', async (req, res) => {
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret.length < 32) return res.status(503).json({ message: 'Payment webhook is not configured with a strong secret' });
  const signature = req.get('x-webhook-signature');
  const expected = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(req.body)).digest('hex');
  const signatureBuffer = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return res.status(401).json({ message: 'Invalid webhook signature' });
  }
  const { reference, status } = req.body;
  if (!reference || !['successful', 'failed', 'pending'].includes(status)) return res.status(400).json({ message: 'Reference and valid status are required' });
  const current = await Payment.findOne({ reference });
  if (!current) return res.status(404).json({ message: 'Payment not found' });
  if (current.gateway === 'manual') return res.status(409).json({ message: 'Manual payments must be verified by finance staff' });
  if (current.status === status) return res.json({ received: true, alreadyProcessed: true, payment: current });
  if (current.status !== 'pending') return res.status(409).json({ message: 'Payment state cannot transition from its current status' });
  const payment = await Payment.findOneAndUpdate(
    { _id: current._id, status: 'pending' },
    { status, gatewayPayload: req.body, ...(status === 'successful' ? { creditedAt: new Date() } : {}) },
    { new: true }
  );
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (status === 'successful') {
    const fee = await FeeLedger.findOne({ studentId: payment.studentId, balance: { $gt: 0 } }).sort({ createdAt: 1 });
    if (fee) {
      const amountPaid = Math.min(Number(fee.amountDue), Number(fee.amountPaid) + payment.amount);
      fee.amountPaid = amountPaid;
      fee.balance = Math.max(Number(fee.amountDue) - amountPaid, 0);
      fee.status = fee.balance === 0 ? 'paid' : 'partial';
      await fee.save();
    }
  }
  await audit({ actorId: payment.studentId, action: `payment.${status}`, entity: 'Payment', entityId: payment._id, before: current.toObject(), after: payment.toObject() });
  return res.json({ received: true, payment });
});

router.get('/requests', protect, async (req, res) => {
  const staff = ['student_affairs', 'department_admin', 'academic_officer', 'system_admin', 'super_admin'].includes(req.user.role);
  const requests = await StudentRequest.find(staff ? {} : { studentId: req.user._id }).populate('studentId', 'fullName email').sort({ createdAt: -1 });
  return res.json({ requests });
});

router.post('/requests', protect, authorize('student'), async (req, res) => {
  const { type, subject, description } = req.body;
  if (!type || !subject || !description) return res.status(400).json({ message: 'Type, subject, and description are required' });
  const request = await StudentRequest.create({ studentId: req.user._id, type, subject, description });
  return res.status(201).json({ request });
});

router.patch('/requests/:id', protect, authorize('student_affairs', 'department_admin', 'academic_officer', 'system_admin', 'super_admin'), async (req, res) => {
  const updates = {};
  if (['open', 'in_review', 'resolved', 'rejected'].includes(req.body.status)) updates.status = req.body.status;
  if (typeof req.body.response === 'string') updates.response = req.body.response.trim();
  const request = await StudentRequest.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate('studentId', 'fullName email');
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (updates.response || updates.status === 'resolved') {
    await Notification.create({ userId: request.studentId._id, title: 'Request updated', message: updates.response || 'Your request status was updated.' });
  }
  return res.json({ request });
});

router.get('/notifications', protect, async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 });
  return res.json({ notifications });
});

router.patch('/notifications/:id/read', protect, async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id, readAt: null },
    { readAt: new Date() },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: 'Unread notification not found' });
  return res.json({ notification });
});

module.exports = router;
