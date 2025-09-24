/**
 * @fileoverview Venue Model
 * @created 2025-01-15
 * @file venue.js
 * @description This file defines the Venue model schema for managing venue information in the Vic Sports application.
 * It includes venue details, location information, amenities, operating hours, and relationships with owners and courts.
 */

import mongoose from "mongoose";

const venueSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID is required"],
    },
    name: {
      type: String,
      required: [true, "Venue name is required"],
      trim: true,
      maxlength: [100, "Venue name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    address: {
      street: {
        type: String,
        required: [true, "Street address is required"],
        trim: true,
        maxlength: [200, "Street address cannot exceed 200 characters"],
      },
      ward: {
        type: String,
        required: [true, "Ward is required"],
        trim: true,
        maxlength: [50, "Ward cannot exceed 50 characters"],
      },
      district: {
        type: String,
        required: [true, "District is required"],
        trim: true,
        maxlength: [50, "District cannot exceed 50 characters"],
      },
      city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
        maxlength: [50, "City cannot exceed 50 characters"],
      },
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: [true, "Coordinates are required"],
          validate: {
            validator: function(v) {
              return v.length === 2 && 
                     v[0] >= -180 && v[0] <= 180 && // longitude
                     v[1] >= -90 && v[1] <= 90;     // latitude
            },
            message: 'Coordinates must be [longitude, latitude] with valid ranges'
          }
        }
      }
    },

    contactInfo: {
      phone: {
        type: String,
        match: [/^0((3[2-9])|(5[6|8|9])|(7[0|6-9])|(8[1-5|8|9])|(9[0-9]))\d{7}$/, "Please enter a valid Vietnamese phone number"],
        trim: true,
      },
      email: {
        type: String,
        match: [
          /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
          "Please enter a valid email",
        ],
        trim: true,
        lowercase: true,
      },
    },

    images: [{
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty strings
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Image URL must be a valid HTTP/HTTPS URL'
      }
    }],

    amenities: [
      {
        name: {
          type: String,
          required: false,
          trim: true,
          maxlength: [50, "Amenity name cannot exceed 50 characters"],
        },
        icon: {
          type: String,
          trim: true,
        },
        description: {
          type: String,
          maxlength: [200, "Amenity description cannot exceed 200 characters"],
        }
      }
    ],

    operatingHours: [
      {
        dayOfWeek: {
          type: Number,
          min: [0, "Day of week must be between 0 and 6"],
          max: [6, "Day of week must be between 0 and 6"],
        },
        openTime: {
          type: String,
          match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time format (HH:MM)"],
        },
        closeTime: {
          type: String,
          match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time format (HH:MM)"],
        },
        isOpen: {
          type: Boolean,
          default: true,
        }
      }
    ],

    parking: {
      available: {
        type: Boolean,
        default: false,
      },
      capacity: {
        type: Number,
        min: [0, "Parking capacity cannot be negative"],
      },
      fee: {
        type: Number,
        min: [0, "Parking fee cannot be negative"],
      }
    },

    ratings: {
      average: {
        type: Number,
        default: 0,
        min: [0, "Rating cannot be less than 0"],
        max: [5, "Rating cannot be more than 5"],
      },
      count: {
        type: Number,
        default: 0,
        min: [0, "Rating count cannot be negative"],
      }
    },

    totalBookings: {
      type: Number,
      default: 0,
      min: [0, "Total bookings cannot be negative"],
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: [0, "Total revenue cannot be negative"],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    }
  },
  {
    timestamps: true,
  }
);

// Virtual for venue info
venueSchema.virtual("venueInfo").get(function () {
  return `${this.name} - ${this.address.street}, ${this.address.ward}, ${this.address.district}, ${this.address.city}`;
});

// Indexes for better query performance
venueSchema.index({ "address.city": 1, "address.district": 1 });
venueSchema.index({ "address.coordinates": "2dsphere" });
venueSchema.index({ ownerId: 1 });
venueSchema.index({ isActive: 1, isVerified: 1 });
venueSchema.index({ name: "text", description: "text" });

// Pre-save middleware
venueSchema.pre('save', function(next) {
  // Ensure coordinates are properly formatted
  if (this.address && this.address.coordinates) {
    this.address.coordinates.lat = parseFloat(this.address.coordinates.lat);
    this.address.coordinates.lng = parseFloat(this.address.coordinates.lng);
  }
  next();
});

const Venue = mongoose.model("Venue", venueSchema);

export default Venue;
