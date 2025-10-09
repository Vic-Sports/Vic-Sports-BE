import mongoose from "mongoose";

const tournamentRegistrationSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    teamName: String,
    teamMembers: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["captain", "member", "substitute"] },
        isConfirmed: { type: Boolean, default: false }
      }
    ],

    registeredAt: { type: Date, default: Date.now },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending"
    },
    paymentId: String,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "withdrawn"],
      default: "pending"
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectionReason: String,
    notes: String,
    withdrawnBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    withdrawnAt: Date,
    withdrawalReason: String,

    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    },
    medicalConditions: String
  },
  { timestamps: true }
);

tournamentRegistrationSchema.index({ tournamentId: 1 });
tournamentRegistrationSchema.index({ participantId: 1 });

const TournamentRegistration = mongoose.model(
  "TournamentRegistration",
  tournamentRegistrationSchema
);

export default TournamentRegistration;
