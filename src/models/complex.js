const mongoose = require("mongoose");

const complexSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    address: {
      province: String,
      district: String,
      ward: String,
      street: String
    },
    images: [String], // ảnh cụm sân
    phone: String,
    email: String,
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    }
  },
  { timestamps: true }
);

complexSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Complex", complexSchema);
