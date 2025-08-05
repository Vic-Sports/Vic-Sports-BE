const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    // --- Quan hệ với User và SubField ---
    user: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: [true, "User is required"] 
    },
    subField: { 
      type: Schema.Types.ObjectId, 
      ref: "SubField", 
      required: [true, "Sub field is required"] 
    },

    // --- Thông tin đặt sân ---
    date: { 
      type: Date, 
      required: [true, "Booking date is required"] 
    },
    timeSlot: {
      from: { 
        type: String, 
        required: [true, "Start time is required"],
        match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"]
      },
      to: { 
        type: String, 
        required: [true, "End time is required"],
        match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"]
      },
      duration: {
        type: Number, // minutes
        required: [true, "Duration is required"],
        min: [30, "Minimum duration is 30 minutes"],
        max: [480, "Maximum duration is 8 hours"]
      }
    },

    // --- Trạng thái đặt sân ---
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed", 
        "cancelled",
        "completed",
        "no-show",
        "refunded",
        "refund_pending"
      ],
      default: "pending"
    },

    // --- Thông tin thanh toán ---
    paymentMethod: {
      type: String,
      enum: ["vnpay", "cash", "bank_transfer", "momo", "zalopay"],
      required: [true, "Payment method is required"]
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "refund_pending"],
      default: "pending"
    },

    // --- Tính toán giá ---
    pricing: {
      basePrice: { 
        type: Number, 
        required: true, 
        min: 0 
      },
      peakHourSurcharge: { 
        type: Number, 
        default: 0, 
        min: 0 
      },
      weekendSurcharge: { 
        type: Number, 
        default: 0, 
        min: 0 
      },
      holidaySurcharge: { 
        type: Number, 
        default: 0, 
        min: 0 
      },
      subtotal: { 
        type: Number, 
        required: true, 
        min: 0 
      },
      tax: { 
        type: Number, 
        default: 0, 
        min: 0 
      },
      discount: { 
        type: Number, 
        default: 0, 
        min: 0 
      },
      totalPrice: { 
        type: Number, 
        required: true, 
        min: 0 
      }
    },

    // --- Mã giảm giá ---
    discountCode: { 
      type: String, 
      trim: true, 
      uppercase: true 
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    // --- Thông tin người chơi ---
    players: {
      count: {
        type: Number,
        min: [1, "At least 1 player is required"],
        required: [true, "Player count is required"]
      },
      names: {
        type: [String],
        default: []
      },
      skillLevel: {
        type: String,
        enum: ["beginner", "intermediate", "advanced", "professional"],
        default: "intermediate"
      }
    },

    // --- Thông tin bổ sung ---
    specialRequests: {
      type: String,
      trim: true,
      maxlength: [500, "Special requests cannot exceed 500 characters"]
    },
    equipment: {
      type: [String],
      default: []
    },
    notes: {
      type: String,
      trim: true
    },

    // --- Đánh giá ---
    isRated: { 
      type: Boolean, 
      default: false 
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: {
      type: String,
      trim: true,
      maxlength: [1000, "Review cannot exceed 1000 characters"]
    },

    // --- VNPay fields ---
    transactionId: { 
      type: String, 
      trim: true 
    },
    paymentDate: { 
      type: Date 
    },
    vnpTxnRef: { 
      type: String, 
      trim: true 
    },
    vnpResponseCode: { 
      type: String, 
      trim: true 
    },
    vnpBankCode: { 
      type: String, 
      trim: true 
    },
    vnpAmount: { 
      type: Number, 
      min: 0 
    },
    vnpPayDate: { 
      type: String, 
      trim: true 
    },
    vnpTransactionNo: { 
      type: String, 
      trim: true 
    },

    // --- Refund information ---
    refundedAt: { 
      type: Date 
    },
    refundReason: { 
      type: String, 
      trim: true, 
      maxlength: 500 
    },
    refundAmount: { 
      type: Number, 
      min: 0 
    },
    refundTransactionNo: { 
      type: String, 
      trim: true 
    },
    refundResponseCode: { 
      type: String, 
      trim: true 
    },
    refundError: { 
      type: String, 
      trim: true, 
      maxlength: 1000 
    },
    refundAttemptedAt: { 
      type: Date 
    },

    // --- Cancellation information ---
    cancelledAt: { 
      type: Date 
    },
    cancellationReason: { 
      type: String, 
      trim: true, 
      maxlength: 500 
    },
    cancelledBy: {
      type: String,
      enum: ["user", "owner", "admin", "system"],
      default: "user"
    },

    // --- Thông tin thời gian ---
    checkInTime: { 
      type: Date 
    },
    checkOutTime: { 
      type: Date 
    },
    actualDuration: {
      type: Number, // minutes
      min: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
bookingSchema.index({ user: 1 });
bookingSchema.index({ subField: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ createdAt: 1 });
bookingSchema.index({ "timeSlot.from": 1, "timeSlot.to": 1 });

// Compound indexes
bookingSchema.index({ subField: 1, date: 1, status: 1 });
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ date: 1, status: 1 });

// Virtuals
bookingSchema.virtual("formattedTotalPrice").get(function () {
  return this.pricing.totalPrice?.toFixed(2) || "0.00";
});

bookingSchema.virtual("formattedTax").get(function () {
  return this.pricing.tax?.toFixed(2) || "0.00";
});

bookingSchema.virtual("formattedDiscount").get(function () {
  return this.pricing.discount?.toFixed(2) || "0.00";
});

bookingSchema.virtual("formattedSubtotal").get(function () {
  return this.pricing.subtotal?.toFixed(2) || "0.00";
});

bookingSchema.virtual("bookingSummary").get(function () {
  return {
    subtotal: this.formattedSubtotal,
    tax: this.formattedTax,
    discount: this.formattedDiscount,
    total: this.formattedTotalPrice
  };
});

bookingSchema.virtual("isActive").get(function () {
  return ["pending", "confirmed"].includes(this.status);
});

bookingSchema.virtual("isCompleted").get(function () {
  return this.status === "completed";
});

bookingSchema.virtual("isCancelled").get(function () {
  return ["cancelled", "refunded"].includes(this.status);
});

bookingSchema.virtual("canBeCancelled").get(function () {
  const now = new Date();
  const bookingDate = new Date(this.date);
  const timeDiff = bookingDate.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 3600);
  
  return this.status === "confirmed" && hoursDiff > 2; // Can cancel if more than 2 hours before
});

bookingSchema.virtual("formattedDate").get(function () {
  return this.date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

bookingSchema.virtual("formattedTime").get(function () {
  return `${this.timeSlot.from} - ${this.timeSlot.to}`;
});

// Validation hook
bookingSchema.pre("save", function (next) {
  // Validate time slot
  if (!this.timeSlot?.from || !this.timeSlot?.to) {
    return next(new Error("Time slot is required"));
  }

  if (this.timeSlot.from >= this.timeSlot.to) {
    return next(new Error("Start time must be before end time"));
  }

  // Validate pricing calculation
  const expectedTotal = (this.pricing.subtotal + this.pricing.tax - this.pricing.discount).toFixed(2);
  const actualTotal = this.pricing.totalPrice.toFixed(2);

  if (expectedTotal !== actualTotal) {
    return next(new Error("Total price mismatch. Check subtotal, tax, and discount."));
  }

  // Validate date
  const now = new Date();
  if (this.date < now) {
    return next(new Error("Booking date cannot be in the past"));
  }

  next();
});

// Method to calculate total price
bookingSchema.methods.calculateTotalPrice = function () {
  const subtotal = this.pricing.subtotal || 0;
  const tax = this.pricing.tax || 0;
  const discount = this.pricing.discount || 0;
  
  return subtotal + tax - discount;
};

// Method to update booking status
bookingSchema.methods.updateStatus = async function (newStatus, reason = null) {
  const oldStatus = this.status;
  this.status = newStatus;

  if (newStatus === "cancelled") {
    this.cancelledAt = new Date();
    this.cancellationReason = reason;
  } else if (newStatus === "completed") {
    this.checkOutTime = new Date();
    if (this.checkInTime) {
      this.actualDuration = Math.round((this.checkOutTime - this.checkInTime) / (1000 * 60));
    }
  } else if (newStatus === "confirmed") {
    this.checkInTime = new Date();
  }

  await this.save();
  return { oldStatus, newStatus };
};

// Method to process refund
bookingSchema.methods.processRefund = async function (amount, reason) {
  this.status = "refunded";
  this.refundedAt = new Date();
  this.refundAmount = amount;
  this.refundReason = reason;
  this.paymentStatus = "refunded";

  await this.save();
};

// Static method to get booking statistics
bookingSchema.statics.getStats = async function (filters = {}) {
  const stats = await this.aggregate([
    { $match: filters },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: "$pricing.totalPrice" },
        averageRating: { $avg: "$rating" },
        completedBookings: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
        },
        cancelledBookings: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
        }
      }
    }
  ]);

  return stats[0] || {
    totalBookings: 0,
    totalRevenue: 0,
    averageRating: 0,
    completedBookings: 0,
    cancelledBookings: 0
  };
};

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
