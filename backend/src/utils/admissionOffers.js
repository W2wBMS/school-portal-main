const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const { normalizeAdmissionValue, normalizeAdmissionLevel } = require('./admissions');

const DEFAULT_PROFILE_VALUES = {
  programme: 'diploma in agronomy cocoa extension',
  department: 'agronomy',
  level: '200 year 2',
};

function isLegacyDefault(field, value) {
  return normalizeAdmissionValue(value).trim() === DEFAULT_PROFILE_VALUES[field];
}

async function syncPendingAdmissionOffers(records, { includeNotOffered = false } = {}) {
  if (!Array.isArray(records) || records.length === 0) return 0;

  const recordsByName = new Map();
  for (const record of records) {
    const candidates = recordsByName.get(record.normalizedFullName) || [];
    candidates.push(record);
    recordsByName.set(record.normalizedFullName, candidates);
  }

  const statusFilter = includeNotOffered ? { $in: ['not_offered', null] } : { $exists: false };
  const profiles = await StudentProfile.find({
    admissionOfferStatus: statusFilter,
  }).select('_id userId fullName email programme department level').lean();
  const updates = [];
  const userUpdates = [];

  for (const profile of profiles) {
    const normalizedName = normalizeAdmissionValue(profile.fullName);
    const candidates = recordsByName.get(normalizedName) || [];
    const emailMatches = candidates.filter((record) => (
      record.email && record.email.toLowerCase() === String(profile.email || '').toLowerCase()
    ));
    const compatibleCandidates = candidates.filter((record) => (
      (!normalizeAdmissionValue(profile.programme) || isLegacyDefault('programme', profile.programme) || record.normalizedProgramme === normalizeAdmissionValue(profile.programme))
      && (!normalizeAdmissionValue(profile.department) || isLegacyDefault('department', profile.department) || record.normalizedDepartment === normalizeAdmissionValue(profile.department))
      && (!normalizeAdmissionLevel(profile.level) || isLegacyDefault('level', profile.level) || record.normalizedLevel === normalizeAdmissionLevel(profile.level))
    ));
    const match = emailMatches.length === 1
      ? emailMatches[0]
      : compatibleCandidates.length === 1 ? compatibleCandidates[0] : null;
    if (!match) continue;

    const set = { admissionOfferStatus: 'pending' };
    const userSet = {};
    for (const field of ['programme', 'department', 'level']) {
      const importedValue = match[field];
      if (!importedValue) continue;
      if (!profile[field] || isLegacyDefault(field, profile[field])) set[field] = importedValue;
      userSet[field] = importedValue;
    }
    updates.push({
      updateOne: {
        filter: { _id: profile._id, admissionOfferStatus: statusFilter },
        update: { $set: set },
      },
    });
    if (Object.keys(userSet).length) {
      userUpdates.push({
        updateOne: {
          filter: { _id: profile.userId },
          update: { $set: userSet },
        },
      });
    }
  }

  if (updates.length) await StudentProfile.bulkWrite(updates, { ordered: false });
  if (userUpdates.length) await User.bulkWrite(userUpdates, { ordered: false });
  return updates.length;
}

module.exports = { syncPendingAdmissionOffers };
