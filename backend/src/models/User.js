const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DEFAULT_STUDENT_ID_PREFIX = '1029';

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    studentId: {
      type: String,
      default: '',
      unique: true,
      trim: true,
    },
    role: {
      type: String,
      enum: [
        'student',
        'lecturer',
        'department_admin',
        'academic_officer',
        'finance_officer',
        'student_affairs',
        'system_admin',
        'super_admin',
        'hod',
        'pro_vc',
        'vc',
      ],
      default: 'student',
    },
    department: {
      type: String,
      default: '',
    },
    programme: {
      type: String,
      default: '',
    },
    level: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    sessionVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.statics.generateStudentId = async function generateStudentId() {
  const prefix = DEFAULT_STUDENT_ID_PREFIX;
  const lastUser = await this.findOne({
    studentId: { $regex: new RegExp(`^${prefix}\\d{4}$`) },
  })
    .sort({ studentId: -1 })
    .select('studentId');

  let sequence = 1;
  if (lastUser?.studentId) {
    const numericPart = Number(lastUser.studentId.slice(prefix.length));
    if (Number.isInteger(numericPart)) {
      sequence = numericPart + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
};

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre('save', async function ensureStudentId() {
  if (this.studentId && this.studentId.trim()) return;
  this.studentId = await this.constructor.generateStudentId();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function toPublicJSON() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
