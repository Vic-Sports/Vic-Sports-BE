const mongoose = require("mongoose");

const complexSchema = new mongoose.Schema(
  {
    // --- Thông tin chủ sở hữu ---
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner is required"]
    },

    // --- Thông tin cơ bản ---
    name: {
      type: String,
      required: [true, "Complex name is required"],
      trim: true,
      maxlength: [100, "Complex name cannot exceed 100 characters"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"]
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },

    // --- Địa chỉ chi tiết ---
    address: {
      province: {
        type: String,
        required: [true, "Province is required"],
        trim: true
      },
      district: {
        type: String,
        required: [true, "District is required"],
        trim: true
      },
      ward: {
        type: String,
        required: [true, "Ward is required"],
        trim: true
      },
      street: {
        type: String,
        trim: true
      },
      fullAddress: {
        type: String,
        required: [true, "Full address is required"],
        trim: true
      }
    },

    // --- Vị trí địa lý ---
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
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
          message: "Invalid coordinates"
        }
      }
    },

    // --- Thông tin liên hệ ---
    contact: {
      phone: {
        type: String,
        required: [true, "Phone number is required"],
        match: [
          /^0((3[2-9])|(5[6|8|9])|(7[0|6-9])|(8[1-5|8|9])|(9[0-9]))\d{7}$/,
          "Phone number is not valid"
        ]
      },
      email: {
        type: String,
        match: [
          /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
          "Email is not valid"
        ]
      },
      website: {
        type: String,
        match: [
          /^https?:\/\/.+/,
          "Website must start with http:// or https://"
        ]
      }
    },

    // --- Hình ảnh và media ---
    images: {
      type: [String],
      default: []
    },
    coverImage: {
      type: String
    },
    logo: {
      type: String
    },

    // --- Thông tin hoạt động ---
    businessHours: {
      monday: {
        open: String, // "06:00"
        close: String, // "22:00"
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      tuesday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      wednesday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      thursday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      friday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      saturday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      sunday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      }
    },

    // --- Tiện ích và dịch vụ ---
    amenities: {
      type: [String],
      enum: {
        values: [
          "parking", "shower", "locker", "cafe", "restaurant", 
          "wifi", "air-conditioning", "heating", "lighting", 
          "security", "first-aid", "equipment-rental", "coaching"
        ],
        message: "{VALUE} is not a valid amenity"
      }
    },

    // --- Trạng thái và đánh giá ---
    status: {
      type: String,
      enum: {
        values: ["active", "inactive", "maintenance", "closed"],
        message: "{VALUE} is not a valid status"
      },
      default: "active"
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      count: {
        type: Number,
        default: 0
      }
    },

    // --- Thông tin bổ sung ---
    capacity: {
      type: Number,
      min: [1, "Capacity must be at least 1"]
    },
    parkingSpaces: {
      type: Number,
      default: 0
    },
    rules: {
      type: [String],
      default: []
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
complexSchema.index({ location: "2dsphere" });
complexSchema.index({ owner: 1 });
complexSchema.index({ status: 1 });
complexSchema.index({ "address.province": 1, "address.district": 1 });
complexSchema.index({ slug: 1 });

// Virtual for formatted address
complexSchema.virtual("formattedAddress").get(function () {
  const addr = this.address;
  return `${addr.street ? addr.street + ', ' : ''}${addr.ward}, ${addr.district}, ${addr.province}`;
});

// Virtual for business hours summary
complexSchema.virtual("isCurrentlyOpen").get(function () {
  const now = new Date();
  const day = now.toLocaleLowerCase().slice(0, 3);
  const time = now.toTimeString().slice(0, 5);
  
  const todayHours = this.businessHours[day];
  if (!todayHours || !todayHours.isOpen) return false;
  
  return time >= todayHours.open && time <= todayHours.close;
});

// Pre-save middleware to generate slug
complexSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-");
  }
  next();
});

// Method to update rating
complexSchema.methods.updateRating = async function () {
  const Review = mongoose.model("Review");
  const stats = await Review.aggregate([
    { $match: { complex: this._id } },
    {
      $group: {
        _id: null,
        average: { $avg: "$rating" },
        count: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    this.rating.average = Math.round(stats[0].average * 10) / 10;
    this.rating.count = stats[0].count;
  } else {
    this.rating.average = 0;
    this.rating.count = 0;
  }

  await this.save();
};

const Complex = mongoose.model("Complex", complexSchema);

export default Complex;
