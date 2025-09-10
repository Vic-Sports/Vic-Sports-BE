import mongoose from "mongoose";

const tournamentMatchSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true
    },
    round: {
      type: String,
      required: true
    },
    matchNumber: {
      type: Number,
      required: true
    },
    team1Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TournamentRegistration"
    },
    team2Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TournamentRegistration"
    },
    team1Score: {
      type: Number,
      default: 0
    },
    team2Score: {
      type: Number,
      default: 0
    },
    scheduledDate: {
      type: Date,
      required: true
    },
    actualStartTime: Date,
    actualEndTime: Date,
    courtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Court"
    },
    refereeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled"
    },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TournamentRegistration"
    },
    notes: String
  },
  { timestamps: true }
);

tournamentMatchSchema.index({ tournamentId: 1, round: 1 });
tournamentMatchSchema.index({ scheduledDate: 1 });

const TournamentMatch = mongoose.model("TournamentMatch", tournamentMatchSchema);

export default TournamentMatch;
