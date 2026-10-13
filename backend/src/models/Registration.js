const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    semester: { type: String, required: true },
    courseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected'], default: 'draft' },
    submittedAt: Date,
    approvedAt: Date,
    lockedAt: Date,
  },
  { timestamps: true }
);

registrationSchema.index({ studentId: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
