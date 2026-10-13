const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    feeLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeLedger' },
    reference: { type: String, required: true, unique: true },
    idempotencyKey: { type: String },
    studentReference: { type: String, trim: true, maxlength: 100 },
    paymentMethod: { type: String, enum: ['bank_transfer', 'mobile_money', 'cash'] },
    amount: { type: Number, required: true, min: 0 },
    purpose: { type: String, default: 'fees' },
    status: { type: String, enum: ['pending', 'successful', 'failed', 'refunded'], default: 'pending' },
    gateway: { type: String, default: 'manual' },
    gatewayPayload: mongoose.Schema.Types.Mixed,
    creditedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verificationNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

paymentSchema.index({ studentId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
paymentSchema.index({ studentReference: 1 }, { unique: true, partialFilterExpression: { studentReference: { $type: 'string' } } });

module.exports = mongoose.model('Payment', paymentSchema);
