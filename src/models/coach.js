import mongoose from "mongoose";

const coachProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    specializedSports: [{ type: String, required: true }],
    experience: { type: Number, required: true },
    certifications: [
      {
        name: String,
        issuedBy: String,
        issuedDate: Date,
        expiryDate: Date,
        certificateUrl: String
      }
    ],
    bio: { type: String, maxlength: 1000 },
    achievements: [String],
    hourlyRate: { type: Number, required: true },
    availability: [
      {
        dayOfWeek: { type: Number, min: 0, max: 6 },
        startTime: String,
        endTime: String
      }
    ],
    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },
    totalSessions: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

coachProfileSchema.index({ userId: 1 });
coachProfileSchema.index({ specializedSports: 1 });
coachProfileSchema.index({ isVerified: 1, isActive: 1 });

const Coach = mongoose.model("Coach", coachProfileSchema);

export default Coach;
