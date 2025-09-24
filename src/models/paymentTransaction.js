import mongoose from "mongoose";

const paymentTransactionSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    paymentRef: {
      type: String,
      unique: true,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["vnpay", "momo", "zalopay", "banking"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "VND",
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "cancelled"],
      default: "pending",
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed, // Response từ payment gateway
    },
    gatewayTransactionId: {
      type: String,
    },
    processedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Indexes
paymentTransactionSchema.index({ paymentRef: 1 });
paymentTransactionSchema.index({ booking: 1 });
paymentTransactionSchema.index({ status: 1 });
paymentTransactionSchema.index({ gatewayTransactionId: 1 });

const PaymentTransaction = mongoose.model(
  "PaymentTransaction",
  paymentTransactionSchema
);

export default PaymentTransaction;
