import mongoose from "mongoose";

const courtSchema = new mongoose.Schema(
  {
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true
    },
    name: { type: String, required: true },
    sportType: { type: String, required: true },
    courtType: { type: String },

    capacity: { type: Number, required: true },
    dimensions: {
      length: Number,
      width: Number,
      unit: { type: String, default: "meters" }
    },

    surface: String,
    equipment: [String],

    pricing: [
      {
        timeSlot: {
          start: String,
          end: String
        },
        pricePerHour: { type: Number, required: true },
        dayType: { type: String, enum: ["weekday", "weekend", "holiday"] },
        isActive: { type: Boolean, default: true }
      }
    ],

    defaultAvailability: [
      {
        dayOfWeek: Number,
        timeSlots: [
          {
            start: String,
            end: String,
            isAvailable: { type: Boolean, default: true }
          }
        ]
      }
    ],

    isActive: { type: Boolean, default: true },
    images: [String],

    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },

    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
  },
  { timestamps: true }
);

courtSchema.index({ venueId: 1 });
courtSchema.index({ sportType: 1 });
courtSchema.index({ isActive: 1 });

const Court = mongoose.model("Court", courtSchema);

export default Court;
