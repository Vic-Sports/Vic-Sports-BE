const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true
    },
    courtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Court",
      required: true
    },

    overallRating: { type: Number, required: true, min: 1, max: 5 },
    detailRatings: {
      facilities: { type: Number, min: 1, max: 5 },
      service: { type: Number, min: 1, max: 5 },
      cleanliness: { type: Number, min: 1, max: 5 },
      value: { type: Number, min: 1, max: 5 }
    },

    comment: { type: String, maxlength: 1000 },
    images: [String],

    coachId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    coachRating: { type: Number, min: 1, max: 5 },
    coachComment: String,

    venueResponse: {
      message: String,
      respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      respondedAt: Date
    },

    pointsAwarded: { type: Number, default: 0 },
    isApproved: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },

    helpfulVotes: { type: Number, default: 0 },
    notHelpfulVotes: { type: Number, default: 0 }
  },
  { timestamps: true }
);

reviewSchema.index({ venueId: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1 });
reviewSchema.index({ bookingId: 1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
