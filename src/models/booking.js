import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    courtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Court",
      required: true
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true
    },

    bookingDate: { type: Date, required: true },
    timeSlot: {
      start: { type: String, required: true },
      end: { type: String, required: true }
    },
    duration: { type: Number, required: true },

    pricePerHour: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    discountApplied: {
      type: { type: String },
      amount: Number,
      percentage: Number
    },
    finalPrice: { type: Number, required: true },

    paymentMethod: {
      type: String,
      enum: ["cash", "card", "transfer", "wallet"]
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending"
    },
    paymentId: String,
    paidAt: Date,

    coachId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    coachFee: Number,

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "no-show"],
      default: "pending"
    },
    cancellationReason: String,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: Date,

    checkedIn: { type: Boolean, default: false },
    checkedInAt: Date,
    checkedOut: { type: Boolean, default: false },
    checkedOutAt: Date,

    customerNotes: String,
    venueNotes: String,

    contactPhone: String,
    contactEmail: String,

    pointsEarned: { type: Number, default: 0 },
    pointsUsed: { type: Number, default: 0 },

    weatherAlertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WeatherAlert"
    },
    weatherImpacted: { type: Boolean, default: false },

    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament" },
    isTournamentMatch: { type: Boolean, default: false }
  },
  { timestamps: true }
);

bookingSchema.index({ customerId: 1 });
bookingSchema.index({ courtId: 1, bookingDate: 1 });
bookingSchema.index({ venueId: 1, bookingDate: 1 });
bookingSchema.index({ status: 1 });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
