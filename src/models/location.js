import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ["city", "district", "ward"], required: true },
    parentCode: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

locationSchema.index({ code: 1 });
locationSchema.index({ parentCode: 1, type: 1 });

const Location = mongoose.model("Location", locationSchema);

export default Location;
