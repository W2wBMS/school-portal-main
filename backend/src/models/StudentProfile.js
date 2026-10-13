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
      default: '',
    },
    department: {
      type: String,
      default: '',
    },
    level: {
      type: String,
      default: '',
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
    admissionOfferStatus: {
      type: String,
      enum: ['not_offered', 'pending', 'accepted'],
      default: 'not_offered',
    },
    admissionOfferAcceptedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
