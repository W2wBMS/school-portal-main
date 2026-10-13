const mongoose = require('mongoose');

const admissionRecordSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  normalizedFullName: { type: String, required: true, trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  programme: { type: String, default: '', trim: true },
  normalizedProgramme: { type: String, default: '', trim: true },
  department: { type: String, default: '', trim: true },
  normalizedDepartment: { type: String, default: '', trim: true },
  level: { type: String, default: '', trim: true },
  normalizedLevel: { type: String, default: '', trim: true },
}, { _id: false });

const admissionListSchema = new mongoose.Schema({
  key: { type: String, enum: ['active'], default: 'active', unique: true },
  records: { type: [admissionRecordSchema], default: [] },
  importedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('AdmissionList', admissionListSchema);