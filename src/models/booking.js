import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    // Support both single court (court) and multi-court (courtIds) booking
    court: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Court",
    },
    courtIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Court",
      },
    ],

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },

    date: { type: String, required: true }, // "YYYY-MM-DD" format as per FE
    timeSlots: [
      {
        start: { type: String, required: true }, // "HH:mm" format
        end: { type: String, required: true }, // "HH:mm" format
        price: { type: Number, required: true },
      },
    ],
    courtQuantity: { type: Number, default: 1 },
    totalPrice: { type: Number, required: true }, // Match FE interface

    // Customer Information - match FE interface
    customerInfo: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
      notes: { type: String }, // Optional notes
    },

    // Payment Information
    bookingCode: { type: String, unique: true }, // 'BK' + timestamp
    paymentMethod: {
      type: String,
      enum: ["vnpay", "momo", "zalopay", "banking", "payos"], // Add PayOS
      default: "vnpay",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "cancelled"],
      default: "pending",
    },
    paymentRef: { type: String }, // Reference từ payment gateway
    paymentId: String,
    paidAt: Date,

    // PayOS specific fields
    payosOrderCode: { type: String }, // PayOS order code
    payosTransactionId: { type: String }, // PayOS transaction ID

    // Booking Status
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },

    // Email tracking
    emailSent: { type: Boolean, default: false }, // Track if confirmation email sent
    emailSentAt: { type: Date }, // When email was sent

    // Multi-Court Booking Support
    groupBookingId: { type: String }, // For linking multiple court bookings
    isGroupBooking: { type: Boolean, default: false },

    // Timestamps
    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    // Hold expiration time for pending bookings
    holdUntil: { type: Date },
  },
  { timestamps: true }
);

// Indexes for efficient queries
bookingSchema.index({ user: 1 });
bookingSchema.index({ court: 1, date: 1 });
bookingSchema.index({ courtIds: 1, date: 1 });
bookingSchema.index({ venue: 1, date: 1 });
bookingSchema.index({ status: 1, paymentStatus: 1 });
bookingSchema.index({ groupBookingId: 1 });
bookingSchema.index({ court: 1, date: 1, status: 1 }); // For availability checks

// Middleware to log paymentStatus changes
bookingSchema.pre("save", function (next) {
  if (this.isModified("paymentStatus")) {
    console.log(
      `💳 [BOOKING MODEL] Payment status changed for booking ${this._id}:`,
      {
        old: this._original?.paymentStatus,
        new: this.paymentStatus,
      }
    );
  }
  next();
});

// Store original values before save
bookingSchema.pre("save", function (next) {
  if (!this.isNew) {
    this._original = this._doc;
  }
  next();
});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
