const mongoose = require('mongoose');

const CUSTOMER_STATUSES = Object.freeze({ ACTIVE: 'ACTIVE' });
const ONBOARDING_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
});
const VERIFICATION_TYPES = Object.freeze({ BVN: 'BVN', NIN: 'NIN' });

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CUSTOMER_STATUSES),
      required: true,
      default: CUSTOMER_STATUSES.ACTIVE,
    },
    onboardingStatus: {
      type: String,
      enum: Object.values(ONBOARDING_STATUSES),
      required: true,
      default: ONBOARDING_STATUSES.PENDING,
    },
    verificationType: {
      type: String,
      enum: Object.values(VERIFICATION_TYPES),
    },
    verificationResult: {
      type: Boolean,
    },
    verifiedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

customerSchema.index({ user: 1 }, { unique: true });

customerSchema.pre('validate', function validateOnboardingState() {
  if (this.onboardingStatus === ONBOARDING_STATUSES.VERIFIED
    && (this.verificationType === undefined || this.verificationResult !== true || !this.verifiedAt)) {
    this.invalidate('onboardingStatus', 'Verified customers require a successful verification result');
  }

  if (this.onboardingStatus === ONBOARDING_STATUSES.FAILED && this.verificationResult !== false) {
    this.invalidate('verificationResult', 'Failed onboarding requires a false verification result');
  }
});

module.exports = mongoose.model('Customer', customerSchema);
module.exports.STATUSES = CUSTOMER_STATUSES;
module.exports.ONBOARDING_STATUSES = ONBOARDING_STATUSES;
module.exports.VERIFICATION_TYPES = VERIFICATION_TYPES;