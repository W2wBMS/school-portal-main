const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/portal');

test('portal router exposes result management endpoints', () => {
  const paths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => Object.keys(layer.route.methods)[0] + ' ' + layer.route.path);

  assert(paths.includes('get /results'));
  assert(paths.includes('post /results'));
  assert(paths.includes('patch /results/:id'));
  assert(paths.includes('post /results/:id/approve'));
  assert(paths.includes('post /results/:id/correct'));
  assert(paths.includes('delete /results/:id'));
});

test('portal router exposes protected finance, attendance, and student service workflows', () => {
  const paths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => Object.keys(layer.route.methods)[0] + ' ' + layer.route.path);

  assert(paths.includes('post /attendance'));
  assert(paths.includes('patch /attendance/:id'));
  assert(paths.includes('post /fees'));
  assert(paths.includes('patch /fees/:id'));
});

test('payment routes expose invoice-linked manual review and student notifications', () => {
  const router = require('../src/routes/v1');
  const paths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => Object.keys(layer.route.methods)[0] + ' ' + layer.route.path);
  const Payment = require('../src/models/Payment');

  assert(paths.includes('get /payments/review'));
  assert(paths.includes('post /payments/initialize'));
  assert(paths.includes('post /payments/:reference/verify'));
  assert(paths.includes('patch /notifications/:id/read'));
  assert.equal(Payment.schema.path('feeLedgerId').options.ref, 'FeeLedger');
  assert.equal(Payment.schema.path('reference').options.unique, true);
  assert.ok(Payment.schema.path('idempotencyKey'));
  assert.ok(Payment.schema.path('studentReference'));
});

test('user router exposes a separate lecturer CSV import route', () => {
  const router = require('../src/routes/users');
  const paths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => Object.keys(layer.route.methods)[0] + ' ' + layer.route.path);

  assert(paths.includes('post /lecturers/import'));
  assert(paths.includes('post /admissions/import'));
});

test('courses can store and update an assigned lecturer', () => {
  const Course = require('../src/models/Course');
  const paths = require('../src/routes/portal').stack
    .filter((layer) => layer.route)
    .map((layer) => Object.keys(layer.route.methods)[0] + ' ' + layer.route.path);

  assert.equal(Course.schema.path('lecturerId').options.ref, 'User');
  assert(paths.includes('patch /courses/:id'));
});

test('assigned course workflows expose rosters, attendance sessions, and timetable fields', () => {
  const portalPaths = require('../src/routes/portal').stack
    .filter((layer) => layer.route)
    .map((layer) => Object.keys(layer.route.methods)[0] + ' ' + layer.route.path);
  const v1Paths = require('../src/routes/v1').stack
    .filter((layer) => layer.route)
    .map((layer) => Object.keys(layer.route.methods)[0] + ' ' + layer.route.path);
  const Course = require('../src/models/Course');

  assert(portalPaths.includes('get /courses/:id/roster'));
  assert(portalPaths.includes('post /attendance/session'));
  assert(v1Paths.includes('get /timetable'));
  assert.ok(Course.schema.path('scheduleDay'));
  assert.ok(Course.schema.path('startTime'));
  assert.ok(Course.schema.path('endTime'));
  assert.ok(Course.schema.path('room'));
});

test('result model keeps the academic identity fields explicit', () => {
  const Result = require('../src/models/Result');
  assert.equal(Result.schema.path('studentId').options.required, true);
  assert.equal(Result.schema.path('courseId').options.required, true);
  assert.equal(Result.schema.path('semester').options.default, 'Semester 1');
});

test('academic utility calculates credit-weighted GPA and CGPA', () => {
  const { calculateAcademicSummary } = require('../src/utils/academics');
  const summary = calculateAcademicSummary([
    { semester: 'Semester 1', grade: 'A', courseId: { credits: 3 } },
    { semester: 'Semester 1', grade: 'B', courseId: { credits: 3 } },
    { semester: 'Semester 2', grade: 'B+', courseId: { credits: 4 } },
  ]);
  assert.equal(summary.semesters[0].gpa, 3.5);
  assert.equal(summary.cgpa, 3.5);
  assert.equal(summary.totalCredits, 10);
});

test('role permission metadata follows resource.action naming', () => {
  const { permissionsForRole } = require('../src/utils/permissions');
  const permissions = permissionsForRole('academic_officer');
  assert(permissions.includes('results.approve'));
  assert(permissions.every((permission) => permission.includes('.') || permission === '*'));
});

test('senior academic roles are registered and result changes require multi-party approval', () => {
  const User = require('../src/models/User');
  const Result = require('../src/models/Result');

  assert(User.schema.path('role').enumValues.includes('hod'));
  assert(User.schema.path('role').enumValues.includes('pro_vc'));
  assert(User.schema.path('role').enumValues.includes('vc'));
  assert.ok(Result.schema.path('resultApprovals.hod'));
  assert.ok(Result.schema.path('resultApprovals.lecturer'));
  assert.ok(Result.schema.path('resultApprovals.admin'));
});
