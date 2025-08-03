const mongoose = require("mongoose");

const sportFieldSchema = new mongoose.Schema(
  {
    complex: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complex",
      required: true
    },
    sportType: {
      type: String,
      enum: ["football", "tennis", "badminton", "pickleball"],
      required: true
    },
    description: String,
    pricePerHour: {
      type: Number,
      required: true
    },
    openTime: String,  // "06:00"
    closeTime: String, // "22:00"
    images: [String]
  },
  { timestamps: true }
);

module.exports = mongoose.model("SportField", sportFieldSchema);
