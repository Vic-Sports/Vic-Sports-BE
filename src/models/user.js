const mongoose = require("mongoose");
const mongoose_delete = require("mongoose-delete");
const avatar = require("../../public/images/avatar/avatar-default.png");
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    // --- Thông tin cơ bản ---
    fullName: {
      type: String,
      required: [true, "Full name is required!"],
      trim: true,
      maxlength: [50, "Full name cannot exceed 50 characters!"]
    },
    dateOfBirth: {
      type: Date,
      default: null
    },
    gender: {
      type: String,
      enum: {
        values: ["male", "female", "other"],
        message: "{VALUE} is not a valid gender"
      },
      default: null
    },
    phone: {
      type: String,
      unique: true,
      trim: true,
      match: [
        /^0((3[2-9])|(5[6|8|9])|(7[0|6-9])|(8[1-5|8|9])|(9[0-9]))\d{7}$/,
        "Số điện thoại không hợp lệ!"
      ],
      default: null
    },
    email: {
      type: String,
      required: [true, "Email is required!"],
      unique: true,
      trim: true,
      lowercase: true,
      default: null,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Email không đúng định dạng!"
      ]
    },
    password: {
      type: String,
      required: [true, "Password is required!"],
      minlength: [6, "Password must be at least 6 characters long!"],
      select: false
    },
    address: {
      province: {
        type: String,
        trim: true
      },
      district: {
        type: String,
        trim: true
      },
      default: null
    },
    avatar: {
      type: String,
      default: avatar
    },
    reward_point: {
      type: Number,
      default: 0,
      min: [0, "Reward points cannot be negative!"]
    },

    // --- Thông tin mở rộng để kết nối bạn bè ---
    favoriteSports: {
      type: [String],
      enum: {
        values: ["football", "tenis", "badminton"],
        message: "{VALUE} is not a valid favorite sports!"
      },
      default: null
    },
    preferredDays: {
      type: [String],
      enum: {
        values: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
          "All"
        ],
        message: "{VALUE} is not a valid preferred days!"
      },
      default: null
    },
    preferredTimeRange: {
      from: String, // "18:00"
      to: String, // "21:00"
      default: null
    },
    bio: {
      type: String,
      trim: true,
      default: null
    },
    featuredImages: { type: [String], default: null },

    // --- Quan hệ xã hội ---
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // --- Role và bảo mật ---
    code: {
      type: Number
    },
    codeExpired: {
      type: Date
    },
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "INACTIVE"],
      },
      required: [true, "Role is required"],
      default: "INACTIVE"
    },
    role: {
      type: String,
      enum: {
        values: ["customer", "owner", "admin"],
        message: "{VALUE} is not a valid role"
      },
      required: [true, "Role is required"],
      default: "USER"
    },
    verificationToken: {
      type: String,
      select: false
    },
    verificationTokenExpires: {
      type: Date,
      select: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    suppressReservedKeysWarning: true
  }
);

// Indexes for better query performance
userSchema.index({ role: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ status: 1 });

// Virtual for full user info
userSchema.virtual("fullInfo").get(function () {
  return `${this.fullName} (${this.phone}) - ${this.role}`;
});

// Virtual rank (dựa theo reward_point)
userSchema.virtual("rank").get(function () {
  const point = this.reward_point;
  if (point >= 10000) return "Diamond";
  if (point >= 5000) return "Gold";
  if (point >= 1000) return "Silver";
  return "Bronze";
});

// Static method to calculate reward points
userSchema.statics.calculateRewardPoints = function (price, rank) {
  const basePoints = Math.floor(price / 10000) * 10; // ví dụ 1tr → 100 điểm
  let bonusMultiplier = 0;

  switch (rank) {
    case "Silver":
      bonusMultiplier = 0.1;
      break;
    case "Gold":
      bonusMultiplier = 0.2;
      break;
    case "Diamond":
      bonusMultiplier = 0.3;
      break;
  }

  return Math.floor(basePoints * (1 + bonusMultiplier));
};

// Encrypt password using bcrypt
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};


userSchema.plugin(mongoose_delete, { overrideMethods: "all" });
const User = mongoose.model("User", userSchema);

module.exports = User;
