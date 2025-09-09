import mongoose from "mongoose";

const venueSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: String,
    
    address: {
      street: { type: String, required: true },
      ward: { type: String, required: true },
      district: { type: String, required: true },
      city: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
      }
    },
    
    contactInfo: {
      phone: String,
      email: String,
      website: String
    },
    
    images: [String],
    
    amenities: [{
      name: String,
      icon: String,
      description: String
    }],
    
    operatingHours: [{
      dayOfWeek: { type: Number, min: 0, max: 6 },
      openTime: String,
      closeTime: String,
      isOpen: { type: Boolean, default: true }
    }],
    
    parking: {
      available: { type: Boolean, default: false },
      capacity: Number,
      fee: Number
    },
    
    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },
    
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date
  }, { timestamps: true });
  
  venueSchema.index({ 'address.city': 1, 'address.district': 1 });
  venueSchema.index({ 'address.coordinates': '2dsphere' });
  venueSchema.index({ ownerId: 1 });

  const Venue = mongoose.model("Venue", venueSchema);

export default Venue;