import test from 'node:test';
import assert from 'node:assert/strict';

import { getDashboardPath, canAccessRole } from './auth';

test('student maps to student dashboard', () => {
  assert.equal(getDashboardPath('student'), '/dashboard/student');
});

test('admin maps to admin dashboard', () => {
  assert.equal(getDashboardPath('system_admin'), '/dashboard/admin');
});

test('lecturer is not allowed in student dashboard', () => {
  assert.equal(canAccessRole('lecturer', 'student'), false);
});

test('hod, pro_vc, and vc map to the admin dashboard and are treated as senior roles', () => {
  assert.equal(getDashboardPath('hod'), '/dashboard/admin');
  assert.equal(getDashboardPath('pro_vc'), '/dashboard/admin');
  assert.equal(getDashboardPath('vc'), '/dashboard/admin');
  assert.equal(canAccessRole('hod', 'department_admin'), true);
  assert.equal(canAccessRole('pro_vc', 'hod'), true);
  assert.equal(canAccessRole('vc', 'pro_vc'), true);
});
