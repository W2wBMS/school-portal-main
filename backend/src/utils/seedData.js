const fs = require('fs');
const path = require('path');
const StudentProfile = require('../models/StudentProfile');
const Course = require('../models/Course');
const Attendance = require('../models/Attendance');
const FeeLedger = require('../models/FeeLedger');
const Result = require('../models/Result');
const User = require('../models/User');
const AdmissionList = require('../models/AdmissionList');
const { parseAdmissionsCsv } = require('./admissions');

async function seedPortalData() {
  if (process.env.NODE_ENV === 'production') {
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

  const courseCount = await Course.countDocuments();

  if (courseCount === 0) {
    const lecturer = await User.findOne({ role: 'lecturer' });

    const courses = await Course.insertMany([
      { code: 'AG 101', title: 'Introduction to Agronomy', credits: 3, lecturerId: lecturer?._id || null, department: 'Agronomy', semester: 'Semester 1' },
      { code: 'CC 204', title: 'Cocoa Production Systems', credits: 4, lecturerId: lecturer?._id || null, department: 'Agronomy', semester: 'Semester 1' },
      { code: 'AG 210', title: 'Soil and Plant Nutrition', credits: 3, lecturerId: lecturer?._id || null, department: 'Agronomy', semester: 'Semester 2' },
    ]);

    const student = await User.findOne({ role: 'student' });

    if (student) {
      const profile = await StudentProfile.findOne({ userId: student._id });
      if (!profile) {
        await StudentProfile.create({
          userId: student._id,
          studentId: student.studentId || '10290001',
          fullName: student.fullName,
          email: student.email,
          programme: 'Diploma in Agronomy & Cocoa Extension',
          department: 'Agronomy',
          level: '200 (Year 2)',
          hallResidence: 'CRIG Hall 3, Room 14B',
          cgpa: 0,
          creditsCompleted: 0,
          feeBalance: 0,
          status: 'registered',
        });
      }

      const resultCourses = await Course.find().limit(3);
      if (await Result.countDocuments({ studentId: student._id }) === 0) {
        await Result.insertMany(resultCourses.map((course, index) => ({
          studentId: student._id,
          courseId: course._id,
          grade: ['A', 'B+', 'A', 'B'][index] || 'A',
          score: [88, 81, 90, 78][index] || 84,
          semester: 'Semester 1',
        })));
      }

      if (await Attendance.countDocuments({ studentId: student._id }) === 0) {
        await Attendance.insertMany(resultCourses.map((course, index) => ({
          studentId: student._id,
          courseId: course._id,
          percentage: [94, 87, 92][index] || 90,
          status: 'present',
          date: new Date(),
        })));
      }

      if (await FeeLedger.countDocuments({ studentId: student._id }) === 0) {
        await FeeLedger.insertMany([
          {
            studentId: student._id,
            invoiceNumber: 'INV-2025-001',
            amountDue: 2800,
            amountPaid: 2800,
            balance: 0,
            status: 'paid',
            semester: '2025/2026 Academic Year',
          },
        ]);
      }
    }
  }
}

module.exports = { seedPortalData };
