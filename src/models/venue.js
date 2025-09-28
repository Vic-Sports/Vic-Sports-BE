import mongoose from "mongoose";

const venueSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    description: String,
    slug: { type: String, lowercase: true, trim: true, unique: true, sparse: true },

    address: {
      street: { type: String, required: true },
      ward: { type: String, required: true },
      district: { type: String, required: true },
      city: { type: String, required: true },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], required: true }, // [lng, lat] format for GeoJSON
      },
    },

    contactInfo: {
      phone: String,
      email: String,
    },

    images: [String],
    coverImage: String,

    // Tags and supported sports for search/faceting
    tags: [String],
    sports: [String],

    amenities: [
      {
        name: String,
        icon: String,
        description: String,
      },
    ],

    operatingHours: [
      {
        dayOfWeek: { type: Number, min: 0, max: 6 },
        openTime: String,
        closeTime: String,
        isOpen: { type: Boolean, default: true },
      },
    ],

    parking: {
      available: { type: Boolean, default: false },
      capacity: Number,
      fee: Number,
    },

    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },

    pricingSummary: {
      minPrice: { type: Number, default: 0 },
      maxPrice: { type: Number, default: 0 },
    },

    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    verifiedAt: Date,
    verificationNotes: String,

    policies: {
      cancellation: String,
      rules: String,
    },
  },
  { timestamps: true }
);

// Virtual field for courts
venueSchema.virtual("courts", {
  ref: "Court",
  localField: "_id",
  foreignField: "venueId",
  match: { isActive: true },
});

// Ensure virtual fields are serialized
venueSchema.set("toJSON", { virtuals: true });
venueSchema.set("toObject", { virtuals: true });

venueSchema.index({ "address.city": 1, "address.district": 1 });
venueSchema.index({ "address.coordinates": "2dsphere" });
venueSchema.index({ ownerId: 1 });
venueSchema.index({ slug: 1 }, { unique: true, sparse: true });
venueSchema.index({ "ratings.average": -1 });
venueSchema.index({ isActive: 1, isVerified: 1 });
venueSchema.index({ name: "text", description: "text" });

const Venue = mongoose.model("Venue", venueSchema);

export default Venue;
