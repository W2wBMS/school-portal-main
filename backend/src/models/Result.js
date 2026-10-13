const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    grade: {
      type: String,
      enum: ['A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
      default: 'A',
    },
    score: {
      type: Number,
      default: 0,
    },
    scoreComponents: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    semester: {
      type: String,
      default: 'Semester 1',
    },
    level: {
      type: String,
      default: '',
      trim: true,
    },
    academicYear: {
      type: String,
      default: '2025/2026',
      trim: true,
    },
    approved: {
      type: Boolean,
      default: false,
    },
    finalized: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: Date,
    resultApprovals: {
      hod: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      lecturer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    correctionReason: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Result', resultSchema);
