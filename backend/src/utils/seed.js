const User = require('../models/User');

async function seedAdmin() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@rucst.edu.gh').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@1234';
  const resetPassword = process.env.BOOTSTRAP_ADMIN_RESET_PASSWORD === 'true';

  let admin = await User.findOne({ email });

  if (!admin) {
    try {
      admin = await User.create({
        fullName: 'System Administrator',
        email,
        password,
        role: 'super_admin',
        studentId: 'ADMIN001',
        isVerified: true,
        status: 'active',
      });
      console.log(`Default super admin (${email}) created successfully`);
    } catch (createErr) {
      console.error('Failed to create super admin with ADMIN001:', createErr.message);
      admin = await User.findOne({ email });
    }
  }

  if (admin) {
    // Verify password matches or reset if requested or locked out by failed attempts
    const isMatch = await admin.comparePassword(password);
    const isLocked = admin.lockUntil && admin.lockUntil > new Date();
    if (!isMatch || resetPassword || admin.status !== 'active' || isLocked) {
      admin.password = password;
      admin.status = 'active';
      admin.isVerified = true;
      admin.role = 'super_admin';
      admin.failedLoginAttempts = 0;
      admin.lockUntil = null;
      admin.sessionVersion = (admin.sessionVersion || 0) + 1;
      await admin.save();
      console.log(`Super admin (${email}) credentials refreshed and unlocked`);
    } else {
      console.log(`Super admin (${email}) is active and verified in MongoDB`);
    }
  }

  try {
    const AuditLog = require('../models/AuditLog');
    const auditCount = await AuditLog.countDocuments();
    if (auditCount === 0 && admin) {
      await AuditLog.create({
        actorId: admin._id,
        action: 'system.initialized',
        entity: 'System',
        metadata: { message: 'Campusly administrative workspace initialized' },
      });
      console.log('Initial system audit log created');
    }
  } catch (error) {
    console.error('Audit log seed check error:', error.message);
  }
}

module.exports = { seedAdmin };
