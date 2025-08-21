import mongoose from "mongoose";
import mongoose_delete from "mongoose-delete";
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
    email: {
      type: String,
      required: [true, "Email is required!"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Email không đúng định dạng!"
      ]
    },
    phone: {
      type: String,
      unique: true,
      trim: true,
      match: [
        /^0((3[2-9])|(5[6|8|9])|(7[0|6-9])|(8[1-5|8|9])|(9[0-9]))\d{7}$/,
        "Số điện thoại không hợp lệ!"
      ]
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters long!"],
      select: false
    },
    avatar: {
      type: String,
      default: "https://res.cloudinary.com/demo/image/upload/v1/samples/people/boy-snow-hoodie.jpg"
    },
    dateOfBirth: {
      type: Date
    },
    gender: {
      type: String,
      enum: {
        values: ["male", "female", "other"],
        message: "{VALUE} is not a valid gender"
      }
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
      ward: {
        type: String,
        trim: true
      },
      street: {
        type: String,
        trim: true
      }
    },

    // --- Social Login ---
    socialLogin: {
      google: {
        id: String,
        email: String,
        name: String,
        picture: String
      },
      facebook: {
        id: String,
        email: String,
        name: String,
        picture: String
      }
    },

    // --- Role và bảo mật ---
    role: {
      type: String,
      enum: {
        values: ["customer", "owner", "admin"],
        message: "{VALUE} is not a valid role"
      },
      required: [true, "Role is required"],
      default: "customer"
    },
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "INACTIVE", "BANNED"],
        message: "{VALUE} is not a valid status"
      },
      required: [true, "Status is required"],
      default: "INACTIVE"
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationToken: {
      type: String,
      select: false
    },
    verificationTokenExpires: {
      type: Date,
      select: false
    },

    // --- Hệ thống điểm và xếp hạng ---
    rewardPoints: {
      type: Number,
      default: 0,
      min: [0, "Reward points cannot be negative!"]
    },
    totalBookings: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },

    // --- Thông tin sở thích ---
    favoriteSports: {
      type: [String],
      enum: {
        values: ["football", "tennis", "badminton", "basketball", "volleyball", "table-tennis"],
        message: "{VALUE} is not a valid favorite sport!"
      }
    },
    preferredDays: {
      type: [String],
      enum: {
        values: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        message: "{VALUE} is not a valid preferred day!"
      }
    },
    preferredTimeRange: {
      from: String, // "18:00"
      to: String    // "21:00"
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters!"]
    },
    featuredImages: {
      type: [String],
      default: []
    },

    // --- Quan hệ xã hội ---
    friends: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    friendRequests: [{
      from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending"
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    blockedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],

    // --- Thông tin liên hệ khẩn cấp ---
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    },

    // --- Cài đặt thông báo ---
    notificationSettings: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ "socialLogin.google.id": 1 });
userSchema.index({ "socialLogin.facebook.id": 1 });

// Virtual for full user info
userSchema.virtual("fullInfo").get(function () {
  return `${this.fullName} (${this.phone}) - ${this.role}`;
});

// Virtual rank (dựa theo rewardPoints)
userSchema.virtual("rank").get(function () {
  const points = this.rewardPoints;
  if (points >= 10000) return "Diamond";
  if (points >= 5000) return "Gold";
  if (points >= 1000) return "Silver";
  return "Bronze";
});

// Virtual for social login status
userSchema.virtual("hasSocialLogin").get(function () {
  return !!(this.socialLogin?.google?.id || this.socialLogin?.facebook?.id);
});

// Static method to calculate reward points
userSchema.statics.calculateRewardPoints = function (price, rank) {
  const basePoints = Math.floor(price / 10000) * 10; // 1tr → 100 điểm
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
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to add friend
userSchema.methods.addFriend = async function (friendId) {
  if (!this.friends.includes(friendId)) {
    this.friends.push(friendId);
    await this.save();
  }
};

// Method to remove friend
userSchema.methods.removeFriend = async function (friendId) {
  this.friends = this.friends.filter(id => !id.equals(friendId));
  await this.save();
};

// Method to block user
userSchema.methods.blockUser = async function (userId) {
  if (!this.blockedUsers.includes(userId)) {
    this.blockedUsers.push(userId);
    // Remove from friends if exists
    this.friends = this.friends.filter(id => !id.equals(userId));
    await this.save();
  }
};

// Method to unblock user
userSchema.methods.unblockUser = async function (userId) {
  this.blockedUsers = this.blockedUsers.filter(id => !id.equals(userId));
  await this.save();
};

userSchema.plugin(mongoose_delete, { overrideMethods: "all" });
const User = mongoose.model("User", userSchema);

export default User;
