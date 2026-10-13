const fs = require('fs');
const path = require('path');
const AdmissionList = require('../models/AdmissionList');
const { parseAdmissionsCsv } = require('./admissions');
const { syncPendingAdmissionOffers } = require('./admissionOffers');

async function seedPortalData() {
  if (process.env.NODE_ENV === 'production') {
    const admissionList = await AdmissionList.findOne({ key: 'active' }).lean();
    if (admissionList?.records?.length) {
      await syncPendingAdmissionOffers(admissionList.records, { includeNotOffered: true });
    }
    console.log('Demo portal data is disabled in production');
    return;
  }

  const admissionsPath = path.resolve(__dirname, '../../data/admissions.csv');
  if (fs.existsSync(admissionsPath) && !(await AdmissionList.exists({ key: 'active' }))) {
    try {
      const records = parseAdmissionsCsv(fs.readFileSync(admissionsPath, 'utf8'));
      await AdmissionList.create({ key: 'active', records });
      console.log(`Loaded ${records.length} local admissions records into MongoDB`);
    } catch (error) {
      console.error(`Local admissions list was not loaded (${error.name})`);
    }
  }
  const admissionList = await AdmissionList.findOne({ key: 'active' }).lean();
  if (admissionList?.records?.length) {
    await syncPendingAdmissionOffers(admissionList.records, { includeNotOffered: true });
  }
}

module.exports = { seedPortalData };
