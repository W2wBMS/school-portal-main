const AuditLog = require('../models/AuditLog');

async function audit({ actorId, action, entity, entityId, before, after, metadata }) {
  try {
    return await AuditLog.create({ actorId, action, entity, entityId, before, after, metadata });
  } catch (error) {
    console.error('Audit log failed:', error.message);
    return null;
  }
}

module.exports = { audit };
