import mongoose from 'mongoose';
const discountSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Discount code is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: [true, 'Discount type is required'],
    },
    value: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
      validate: {
        validator: function (value) {
          if (this.type === 'percentage') {
            return value <= 100;
          }
          return true;
        },
        message: 'Percentage discount cannot exceed 100%',
      },
    },
    minPurchase: {
      type: Number,
      default: 0,
      min: [0, 'Minimum purchase amount cannot be negative'],
    },
    maxDiscount: {
      type: Number,
      min: [0, 'Maximum discount cannot be negative'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    usageLimit: {
      type: Number,
      default: 1,
      min: [1, 'Usage limit must be at least 1'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count cannot be negative'],
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: [1, 'Per user limit must be at least 1'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired'],
      default: 'active',
    },
    description: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ['shop', 'reward_points', 'admin'],
      default: 'shop',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
discountSchema.index({ status: 1 });
discountSchema.index({ startDate: 1 });
discountSchema.index({ endDate: 1 });
discountSchema.index({ applicableProducts: 1 });
discountSchema.index({ applicableCategories: 1 });

// Method to update status based on dates
discountSchema.methods.updateStatus = function () {
  const now = new Date();

  // Check if usage limit is reached
  if (this.usedCount >= this.usageLimit) {
    this.status = 'expired';
    return this.status;
  }

  // Check if end date has passed
  if (now > this.endDate) {
    this.status = 'expired';
  }
  // Check if start date is in the future - keep as active for future discounts
  else if (now < this.startDate) {
    this.status = 'active'; // Changed from 'inactive' to 'active'
  }
  // Currently active period
  else {
    this.status = 'active';
  }

  return this.status;
};

// Pre-save middleware to update status

discountSchema.pre('save', function (next) {
  if (this.isModified('startDate') || this.isModified('endDate') || this.isModified('usedCount')) {
    this.updateStatus();
  }
  next();
});

// Validate dates
discountSchema.pre('save', function (next) {
  if (this.startDate >= this.endDate) {
    next(new Error('End date must be after start date'));
  }
  next();
});

// Check if discount is valid
discountSchema.methods.isValid = function () {
  const now = new Date();
  return (
    this.status === 'active' &&
    now >= this.startDate &&
    now <= this.endDate &&
    this.usedCount < this.usageLimit
  );
};
discountSchema.statics.updateAllDiscountStatus = async function () {
  const discounts = await this.find();
  for (let discount of discounts) {
    const oldStatus = discount.status;
    const newStatus = discount.updateStatus();
    if (oldStatus !== newStatus) {
      await discount.save();
    }
  }
};

const Discount = mongoose.model('Discount', discountSchema);

export default Discount;
