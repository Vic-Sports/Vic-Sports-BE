import mongoose from "mongoose";

const tournamentSchema = new mongoose.Schema(
  {
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true
    },

    name: { type: String, required: true },
    description: String,
    sportType: { type: String, required: true },
    tournamentType: {
      type: String,
      enum: [
        "single_elimination",
        "double_elimination",
        "round_robin",
        "swiss"
      ],
      default: "single_elimination"
    },

    maxParticipants: { type: Number, required: true },
    minParticipants: { type: Number, required: true },
    teamSize: { type: Number, default: 1 },
    currentParticipants: { type: Number, default: 0 },

    registrationStartDate: { type: Date, required: true },
    registrationEndDate: { type: Date, required: true },
    registrationFee: { type: Number, default: 0 },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    estimatedDuration: Number,

    prizePool: { type: Number, default: 0 },
    prizeDistribution: [
      {
        position: String,
        amount: Number,
        percentage: Number,
        description: String
      }
    ],

    rules: [String],
    ageRestrictions: {
      minAge: Number,
      maxAge: Number
    },
    skillLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "all"],
      default: "all"
    },

    status: {
      type: String,
      enum: [
        "draft",
        "registration_open",
        "registration_closed",
        "ongoing",
        "completed",
        "cancelled"
      ],
      default: "draft"
    },

    bannerImage: String,
    gallery: [String],

    allowLivestream: { type: Boolean, default: true },
    streamingRights: {
      type: String,
      enum: ["organizer_only", "participants", "anyone", "none"],
      default: "organizer_only"
    },
    officialStreamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Livestream"
    },

    isPublic: { type: Boolean, default: true },
    allowSpectators: { type: Boolean, default: true },
    spectatorFee: { type: Number, default: 0 },

    requireApproval: { type: Boolean, default: false },
    allowSubstitutes: { type: Boolean, default: false }
  },
  { timestamps: true }
);

tournamentSchema.index({ venueId: 1, startDate: 1 });
tournamentSchema.index({ sportType: 1, status: 1 });
tournamentSchema.index({ registrationStartDate: 1, registrationEndDate: 1 });

const Tournament = mongoose.model("Tournament", tournamentSchema);

export default Tournament;
