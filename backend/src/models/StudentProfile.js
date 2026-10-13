const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    studentId: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    programme: {
      type: String,
      default: 'Diploma in Agronomy & Cocoa Extension',
    },
    department: {
      type: String,
      default: 'Agronomy',
    },
    level: {
      type: String,
      default: '200 (Year 2)',
    },
    hallResidence: {
      type: String,
      default: '',
    },
    cgpa: {
      type: Number,
      default: 0,
    },
    creditsCompleted: {
      type: Number,
      default: 0,
    },
    feeBalance: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'registered', 'inactive'],
      default: 'registered',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
