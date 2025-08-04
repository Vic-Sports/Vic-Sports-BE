const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subField: { type: Schema.Types.ObjectId, ref: "SubField", required: true },

    date: { type: Date, required: true },
    timeSlot: {
      from: { type: String, required: true },
      to: { type: String, required: true }
    },

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "confirmed",
        "cancelled",
        "refunded",
        "refund_pending",
        "completed"
      ],
      default: "pending"
    },

    paymentMethod: {
      type: String,
      enum: ["vnpay", "cash"],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "refund_pending"],
      default: "pending"
    },

    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },

    discountCode: { type: String, trim: true, uppercase: true },
    isRated: { type: Boolean, default: false },

    // VNPay fields
    transactionId: { type: String, trim: true },
    paymentDate: { type: Date },
    vnpTxnRef: { type: String, trim: true },
    vnpResponseCode: { type: String, trim: true },
    vnpBankCode: { type: String, trim: true },
    vnpAmount: { type: Number, min: 0 },
    vnpPayDate: { type: String, trim: true },
    vnpTransactionNo: { type: String, trim: true },

    // Refund
    refundedAt: { type: Date },
    refundReason: { type: String, trim: true, maxlength: 500 },
    refundAmount: { type: Number, min: 0 },
    refundTransactionNo: { type: String, trim: true },
    refundResponseCode: { type: String, trim: true },
    refundError: { type: String, trim: true, maxlength: 1000 },
    refundAttemptedAt: { type: Date },

    // Cancellation
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true, maxlength: 500 }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ createdAt: 1 });

// Virtuals
bookingSchema.virtual("formattedTotalPrice").get(function () {
  return this.totalPrice?.toFixed(2) || "0.00";
});

bookingSchema.virtual("formattedTax").get(function () {
  return this.tax?.toFixed(2) || "0.00";
});

bookingSchema.virtual("formattedDiscount").get(function () {
  return this.discount?.toFixed(2) || "0.00";
});

bookingSchema.virtual("formattedSubtotal").get(function () {
  return this.subtotal?.toFixed(2) || "0.00";
});

bookingSchema.virtual("bookingSummary").get(function () {
  return {
    subtotal: this.formattedSubtotal,
    tax: this.formattedTax,
    discount: this.formattedDiscount,
    total: this.formattedTotalPrice
  };
});

// Validation hook
bookingSchema.pre("save", function (next) {
  if (!this.timeSlot?.from || !this.timeSlot?.to) {
    return next(new Error("Time slot is required"));
  }

  const expectedTotal = (this.subtotal + this.tax - this.discount).toFixed(2);
  const actualTotal = this.totalPrice.toFixed(2);

  if (expectedTotal !== actualTotal) {
    return next(
      new Error("Total price mismatch. Check subtotal, tax, and discount.")
    );
  }

  next();
});

module.exports = mongoose.model("Booking", bookingSchema);
