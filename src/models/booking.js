const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    subField: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubField",
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    timeSlot: {
      from: String, // "18:00"
      to: String // "20:00"
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
    totalPrice: {
      type: Number,
      required: [true, "Total price is required"],
      min: [0, "Price cannot be negative"]
    },
    paymentMethod: {
      type: String,
      enum: ["vnpay", "cash"],
      required: [true, "Payment method is required"]
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "refund_pending"],
      default: "pending"
    },
    isRated: {
      type: Boolean,
      default: false
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, "Tax cannot be negative"]
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"]
    },
    discountCode: {
      type: String,
      trim: true,
      uppercase: true
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"]
    },
    // VNPay transaction fields
    transactionId: {
      type: String,
      trim: true
    },
    paymentDate: {
      type: Date
    },
    vnpResponseCode: {
      type: String,
      trim: true
    },
    vnpTxnRef: {
      type: String,
      trim: true
    },
    vnpAmount: {
      type: Number,
      min: [0, "Amount cannot be negative"]
    },
    vnpBankCode: {
      type: String,
      trim: true
    },
    vnpPayDate: {
      type: String,
      trim: true
    },
    // VNPay transaction number for refunds
    vnpTransactionNo: {
      type: String,
      trim: true
    },
    // Refund-related fields
    refundedAt: {
      type: Date
    },
    refundReason: {
      type: String,
      trim: true,
      maxlength: [500, "Refund reason cannot exceed 500 characters"]
    },
    refundAmount: {
      type: Number,
      min: [0, "Refund amount cannot be negative"]
    },
    refundTransactionNo: {
      type: String,
      trim: true
    },
    refundResponseCode: {
      type: String,
      trim: true
    },
    // Refund pending and error tracking
    refundError: {
      type: String,
      trim: true,
      maxlength: [1000, "Refund error cannot exceed 1000 characters"]
    },
    refundAttemptedAt: {
      type: Date
    },
    // Cancellation fields
    cancelledAt: {
      type: Date
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"]
    }
  },
  { timestamps: true }
);

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ subField: 1, date: 1, "timeSlot.from": 1 });

module.exports = mongoose.model("Booking", bookingSchema);
