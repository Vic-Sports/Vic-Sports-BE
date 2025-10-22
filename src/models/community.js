import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required!"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters!"],
    },
    description: {
      type: String,
      required: [true, "Description is required!"],
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    court: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Court",
      required: true,
    },
    date: {
      type: String,
      required: [true, "Date is required!"], // Format: YYYY-MM-DD
    },
    timeSlot: {
      start: {
        type: String,
        required: [true, "Start time is required!"], // Format: HH:mm
      },
      end: {
        type: String,
        required: [true, "End time is required!"], // Format: HH:mm
      },
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    rejectedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ], // Added to track rejected users
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    maxParticipants: {
      type: Number,
      required: [true, "Maximum participants is required!"],
      min: [1, "At least 1 participant is required!"],
    },
    currentParticipants: {
      type: Number,
      default: 0,
      validate: {
        validator: function (value) {
          return value <= this.maxParticipants;
        },
        message: "currentParticipants cannot be greater than maxParticipants",
      },
    },
    status: {
      type: String,
      enum: ["open", "closed", "cancelled"],
      default: "open",
    },
    sport: {
      type: String,
      required: [true, "Sport type is required!"],
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Location is required!"],
      trim: true,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    media: {
      videos: [
        {
          type: String,
          trim: true,
        },
      ],
    },
  },
  { timestamps: true }
);

communitySchema.index({ user: 1 });
communitySchema.index({ court: 1, date: 1 });
communitySchema.index({ status: 1 });

const Community = mongoose.model("Community", communitySchema);

export default Community;
