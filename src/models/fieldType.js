const mongoose = require("mongoose");

const fieldTypeSchema = new mongoose.Schema(
  {
    // --- Thông tin cơ bản ---
    name: {
      type: String,
      required: [true, "Field type name is required"],
      trim: true,
      maxlength: [50, "Field type name cannot exceed 50 characters"]
    },
    sportType: {
      type: String,
      required: [true, "Sport type is required"],
      enum: {
        values: [
          "football", "tennis", "badminton", "basketball", 
          "volleyball", "table-tennis", "squash", "golf",
          "swimming", "gym", "yoga", "martial-arts"
        ],
        message: "{VALUE} is not a valid sport type"
      }
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },

    // --- Thông tin kỹ thuật ---
    specifications: {
      surface: {
        type: String,
        enum: {
          values: [
            "natural-grass", "artificial-grass", "clay", "hard-court",
            "carpet", "concrete", "wooden", "synthetic", "sand"
          ],
          message: "{VALUE} is not a valid surface type"
        }
      },
      size: {
        length: {
          type: Number,
          min: [1, "Length must be at least 1 meter"]
        },
        width: {
          type: Number,
          min: [1, "Width must be at least 1 meter"]
        },
        unit: {
          type: String,
          enum: ["meters", "feet"],
          default: "meters"
        }
      },
      capacity: {
        type: Number,
        min: [1, "Capacity must be at least 1 player"],
        required: [true, "Capacity is required"]
      },
      lighting: {
        type: String,
        enum: {
          values: ["none", "basic", "professional", "stadium"],
          message: "{VALUE} is not a valid lighting type"
        },
        default: "none"
      },
      roof: {
        type: String,
        enum: {
          values: ["none", "partial", "full"],
          message: "{VALUE} is not a valid roof type"
        },
        default: "none"
      }
    },

    // --- Giá cả và đặt sân ---
    pricing: {
      basePrice: {
        type: Number,
        required: [true, "Base price is required"],
        min: [0, "Base price cannot be negative"]
      },
      currency: {
        type: String,
        enum: ["VND", "USD"],
        default: "VND"
      },
      pricePerHour: {
        type: Number,
        required: [true, "Price per hour is required"],
        min: [0, "Price per hour cannot be negative"]
      },
      peakHourPrice: {
        type: Number,
        min: [0, "Peak hour price cannot be negative"]
      },
      offPeakPrice: {
        type: Number,
        min: [0, "Off-peak price cannot be negative"]
      },
      weekendPrice: {
        type: Number,
        min: [0, "Weekend price cannot be negative"]
      },
      holidayPrice: {
        type: Number,
        min: [0, "Holiday price cannot be negative"]
      }
    },

    // --- Thời gian hoạt động ---
    operatingHours: {
      openTime: {
        type: String,
        required: [true, "Open time is required"],
        match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"]
      },
      closeTime: {
        type: String,
        required: [true, "Close time is required"],
        match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"]
      },
      peakHours: {
        start: {
          type: String,
          match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"]
        },
        end: {
          type: String,
          match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"]
        }
      },
      bookingDuration: {
        type: Number,
        min: [30, "Minimum booking duration is 30 minutes"],
        max: [480, "Maximum booking duration is 8 hours"],
        default: 60 // minutes
      },
      advanceBookingDays: {
        type: Number,
        min: [0, "Advance booking days cannot be negative"],
        max: [365, "Advance booking days cannot exceed 1 year"],
        default: 7
      }
    },

    // --- Quy tắc và điều kiện ---
    rules: {
      type: [String],
      default: []
    },
    requirements: {
      type: [String],
      default: []
    },
    restrictions: {
      type: [String],
      default: []
    },

    // --- Trạng thái ---
    status: {
      type: String,
      enum: {
        values: ["active", "inactive", "maintenance"],
        message: "{VALUE} is not a valid status"
      },
      default: "active"
    },

    // --- Thống kê ---
    stats: {
      totalBookings: {
        type: Number,
        default: 0
      },
      totalRevenue: {
        type: Number,
        default: 0
      },
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      reviewCount: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
fieldTypeSchema.index({ sportType: 1 });
fieldTypeSchema.index({ status: 1 });
fieldTypeSchema.index({ "specifications.surface": 1 });
fieldTypeSchema.index({ "pricing.pricePerHour": 1 });

// Virtual for formatted size
fieldTypeSchema.virtual("formattedSize").get(function () {
  const size = this.specifications.size;
  if (!size) return null;
  return `${size.length} x ${size.width} ${size.unit}`;
});

// Virtual for current price based on time
fieldTypeSchema.virtual("currentPrice").get(function () {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const time = `${hour.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Weekend pricing
  if (day === 0 || day === 6) {
    return this.pricing.weekendPrice || this.pricing.pricePerHour;
  }
  
  // Peak hour pricing
  if (this.operatingHours.peakHours && 
      time >= this.operatingHours.peakHours.start && 
      time <= this.operatingHours.peakHours.end) {
    return this.pricing.peakHourPrice || this.pricing.pricePerHour;
  }
  
  // Off-peak pricing
  return this.pricing.offPeakPrice || this.pricing.pricePerHour;
});

// Virtual for availability status
fieldTypeSchema.virtual("isAvailable").get(function () {
  const now = new Date();
  const time = now.toTimeString().slice(0, 5);
  return time >= this.operatingHours.openTime && time <= this.operatingHours.closeTime;
});

// Pre-save middleware to validate pricing
fieldTypeSchema.pre("save", function (next) {
  // Ensure base price is set if not provided
  if (!this.pricing.basePrice) {
    this.pricing.basePrice = this.pricing.pricePerHour;
  }
  
  // Validate peak hours if provided
  if (this.operatingHours.peakHours?.start && this.operatingHours.peakHours?.end) {
    if (this.operatingHours.peakHours.start >= this.operatingHours.peakHours.end) {
      return next(new Error("Peak hours start time must be before end time"));
    }
  }
  
  next();
});

// Method to calculate price for specific duration
fieldTypeSchema.methods.calculatePrice = function (duration, date = new Date()) {
  const day = date.getDay();
  const hour = date.getHours();
  const time = `${hour.toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  
  let basePrice = this.pricing.pricePerHour;
  
  // Weekend pricing
  if (day === 0 || day === 6) {
    basePrice = this.pricing.weekendPrice || basePrice;
  }
  // Peak hour pricing
  else if (this.operatingHours.peakHours && 
           time >= this.operatingHours.peakHours.start && 
           time <= this.operatingHours.peakHours.end) {
    basePrice = this.pricing.peakHourPrice || basePrice;
  }
  // Off-peak pricing
  else {
    basePrice = this.pricing.offPeakPrice || basePrice;
  }
  
  return Math.ceil(duration / 60) * basePrice; // duration in minutes
};

const FieldType = mongoose.model("FieldType", fieldTypeSchema);

export default FieldType; 