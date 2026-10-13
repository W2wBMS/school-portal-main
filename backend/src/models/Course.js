const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    credits: {
      type: Number,
      required: true,
    },
    lecturerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    department: {
      type: String,
      default: 'Agronomy',
    },
    semester: {
      type: String,
      default: 'Semester 1',
    },
    scheduleDay: { type: String, enum: ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], default: '' },
    startTime: { type: String, default: '', match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, default: '', match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    room: { type: String, default: '', trim: true, maxlength: 100 },
    programmes: [{ type: String }],
    levels: [{ type: String }],
    prerequisiteCourseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
