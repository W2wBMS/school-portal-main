const ROLE_HIERARCHY = {
  student: 0,
  lecturer: 1,
  department_admin: 2,
  academic_officer: 3,
  finance_officer: 4,
  student_affairs: 5,
  system_admin: 6,
  super_admin: 7,
  hod: 8,
  pro_vc: 9,
  vc: 10,
};

const ROLE_PERMISSIONS = {
  student: ['students.view', 'students.update', 'courses.view', 'registrations.create', 'results.view', 'fees.view', 'payments.create', 'requests.create'],
  lecturer: ['courses.view', 'attendance.view', 'attendance.update', 'results.enter', 'results.submit'],
  department_admin: ['students.view', 'students.create', 'students.update', 'courses.view', 'courses.create', 'courses.update', 'registrations.approve', 'results.enter', 'results.approve', 'fees.view', 'requests.assign', 'audit.view'],
  academic_officer: ['students.view', 'students.create', 'students.update', 'courses.view', 'courses.create', 'courses.update', 'registrations.approve', 'results.enter', 'results.submit', 'results.approve', 'requests.assign', 'audit.view'],
  finance_officer: ['students.view', 'fees.view', 'fees.create', 'fees.update', 'payments.verify', 'audit.view'],
  student_affairs: ['students.view', 'students.create', 'students.update', 'requests.assign', 'audit.view'],
  system_admin: ['users.manage', 'audit.view', 'students.view', 'students.create', 'students.update', 'courses.view', 'courses.create', 'courses.update', 'registrations.approve', 'results.enter', 'results.submit', 'results.approve', 'fees.view', 'fees.create', 'fees.update', 'payments.verify', 'requests.assign'],
  super_admin: ['*'],
  hod: ['*'],
  pro_vc: ['*'],
  vc: ['*'],
};

function isRoleAtLeast(role, minimumRole) {
  const currentRank = ROLE_HIERARCHY[role] ?? -1;
  const minimumRank = ROLE_HIERARCHY[minimumRole] ?? -1;
  return currentRank >= minimumRank;
}

function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(role, permission) {
  const permissions = permissionsForRole(role);
  return permissions.includes('*') || permissions.includes(permission);
}

module.exports = { ROLE_PERMISSIONS, ROLE_HIERARCHY, permissionsForRole, hasPermission, isRoleAtLeast };
