import mongoose from "mongoose";

const paymentSessionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: function () {
        return `payment_session_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      },
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["vnpay", "momo", "zalopay", "bank_transfer"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "expired"],
      default: "pending",
    },
    paymentUrl: {
      type: String,
    },
    qrCode: {
      type: String,
    },
    transactionId: {
      type: String,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: function () {
        return new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      },
    },
  },
  {
    timestamps: true,
    collection: "payment_sessions",
  }
);

// Index for efficient queries
paymentSessionSchema.index({ bookingId: 1 });
paymentSessionSchema.index({ id: 1 }, { unique: true });
paymentSessionSchema.index({ status: 1 });
paymentSessionSchema.index({ expiresAt: 1 });

const PaymentSession = mongoose.model("PaymentSession", paymentSessionSchema);

export default PaymentSession;
