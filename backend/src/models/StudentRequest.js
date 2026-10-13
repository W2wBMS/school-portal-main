const mongoose = require('mongoose');

const studentRequestSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: ['open', 'in_review', 'resolved', 'rejected'], default: 'open' },
    response: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudentRequest', studentRequestSchema);
