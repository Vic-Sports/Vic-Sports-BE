import mongoose from "mongoose";
import mongoose_delete from "mongoose-delete";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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
      city: {
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
      },
      coordinates: {
        lat: Number,
        lng: Number
      }
    },

    // --- Authentication & Security ---
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      select: false
    },
    emailVerificationExpires: {
      type: Date,
      select: false
    },
    passwordResetToken: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
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

    // --- Multi-Role System ---
    roles: [{
      type: {
        type: String,
        enum: ["customer", "owner", "admin", "coach"],
        required: true
      },
      isActive: {
        type: Boolean,
        default: true
      },
      approvedAt: {
        type: Date,
        default: Date.now
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    
    // Primary role for backward compatibility
    primaryRole: {
      type: String,
      enum: ["customer", "owner", "admin", "coach"],
      required: [true, "Primary role is required"],
      default: "customer"
    },

    // --- Account Status ---
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "INACTIVE", "BANNED"],
        message: "{VALUE} is not a valid status"
      },
      required: [true, "Status is required"],
      default: "INACTIVE"
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    blockedReason: String,
    blockedUntil: Date,
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // --- Loyalty Program ---
    rewardPoints: {
      type: Number,
      default: 0,
      min: [0, "Reward points cannot be negative!"]
    },
    lifetimePoints: {
      type: Number,
      default: 0
    },
    pointsExpiry: [{
      points: {
        type: Number,
        required: true
      },
      expiryDate: {
        type: Date,
        required: true
      }
    }],
    loyaltyTier: {
      type: String,
      enum: ['Bronze', 'Silver', 'Gold', 'Diamond'],
      default: 'Bronze'
    },
    tierAchievedDate: {
      type: Date,
      default: Date.now
    },

    // --- Referral System ---
    referralCode: {
      type: String,
      unique: true,
      sparse: true // Allows null values while maintaining uniqueness
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    referralCount: {
      type: Number,
      default: 0
    },
    referralBonus: {
      type: Number,
      default: 0
    },

    // --- Birthday Program ---
    birthdayVoucherClaimed: {
      type: Boolean,
      default: false
    },
    lastBirthdayVoucherYear: Number,

    // --- Business Statistics ---
    totalBookings: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    totalSaved: {
      type: Number,
      default: 0 // From discounts
    },

    // --- User Preferences ---
    favoriteVenues: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue'
    }],
    favoriteSports: [String],
    preferredBookingTime: {
      start: String, // "18:00"
      end: String    // "22:00"
    },

    // --- Online Status & Communication ---
    isOnline: {
      type: Boolean,
      default: false
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    friends: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    blockedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],

    // --- Notification Settings ---
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
      },
      booking: {
        type: Boolean,
        default: true
      },
      promotion: {
        type: Boolean,
        default: true
      },
      weather: {
        type: Boolean,
        default: true
      },
      tournament: {
        type: Boolean,
        default: true
      },
      chat: {
        type: Boolean,
        default: true
      }
    },

    // --- Privacy Settings ---
    privacySettings: {
      profileVisibility: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'public'
      },
      showOnlineStatus: {
        type: Boolean,
        default: true
      },
      allowFriendRequests: {
        type: Boolean,
        default: true
      },
      showBookingHistory: {
        type: Boolean,
        default: false
      }
    },

    // --- Device & Session ---
    lastLoginDevice: {
      userAgent: String,
      ip: String,
      location: String
    },
    activeTokens: [{
      token: String,
      device: String,
      createdAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: Date
    }],

    // --- Verification & Documents ---
    verificationLevel: {
      type: String,
      enum: ['unverified', 'email_verified', 'phone_verified', 'id_verified'],
      default: 'unverified'
    },
    identityVerification: {
      idNumber: {
        type: String,
        select: false
      },
      idType: {
        type: String,
        enum: ['cccd', 'passport', 'driving_license'],
        select: false
      },
      frontImage: {
        type: String,
        select: false
      },
      backImage: {
        type: String,
        select: false
      },
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.password;
        delete ret.emailVerificationToken;
        delete ret.passwordResetToken;
        delete ret.identityVerification.idNumber;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// --- INDEXES ---
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ primaryRole: 1 });
userSchema.index({ status: 1 });
userSchema.index({ isEmailVerified: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ "socialLogin.google.id": 1 });
userSchema.index({ "socialLogin.facebook.id": 1 });
userSchema.index({ 'address.city': 1, 'address.district': 1 });
userSchema.index({ loyaltyTier: 1 });
userSchema.index({ isOnline: 1 });
userSchema.index({ createdAt: -1 });

// --- VIRTUALS ---
userSchema.virtual("fullInfo").get(function () {
  return `${this.fullName} (${this.phone}) - ${this.primaryRole}`;
});

// Enhanced rank calculation based on lifetimePoints
userSchema.virtual("rank").get(function () {
  const points = this.lifetimePoints || this.rewardPoints;
  if (points >= 10000) return "Diamond";
  if (points >= 5000) return "Gold";
  if (points >= 1000) return "Silver";
  return "Bronze";
});

userSchema.virtual("hasSocialLogin").get(function () {
  return !!(this.socialLogin?.google?.id || this.socialLogin?.facebook?.id);
});

// Check if user has specific role
userSchema.virtual("activeRoles").get(function () {
  return this.roles.filter(role => role.isActive).map(role => role.type);
});

// Get discount percentage based on tier
userSchema.virtual("tierDiscount").get(function () {
  const discounts = {
    'Bronze': 0,
    'Silver': 5,
    'Gold': 10,
    'Diamond': 15
  };
  return discounts[this.loyaltyTier] || 0;
});

// --- STATIC METHODS ---
userSchema.statics.calculateRewardPoints = function (price, tier = 'Bronze') {
  const basePoints = Math.floor(price / 10000) * 10; // 10k VND = 1 point
  
  const multipliers = {
    'Bronze': 1,
    'Silver': 1.1,
    'Gold': 1.2,
    'Diamond': 1.3
  };
  
  return Math.floor(basePoints * (multipliers[tier] || 1));
};

userSchema.statics.generateReferralCode = function () {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// --- INSTANCE METHODS ---
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.hasRole = function (role) {
  return this.roles.some(r => r.type === role && r.isActive);
};

userSchema.methods.addRole = function (roleType, approvedBy) {
  if (!this.hasRole(roleType)) {
    this.roles.push({
      type: roleType,
      isActive: true,
      approvedAt: new Date(),
      approvedBy: approvedBy
    });
  }
};

userSchema.methods.removeRole = function (roleType) {
  this.roles = this.roles.filter(role => role.type !== roleType);
};

userSchema.methods.blockUser = function (userId) {
  if (!this.blockedUsers.includes(userId)) {
    this.blockedUsers.push(userId);
    this.friends = this.friends.filter(id => !id.equals(userId));
  }
};

userSchema.methods.unblockUser = function (userId) {
  this.blockedUsers = this.blockedUsers.filter(id => !id.equals(userId));
};

userSchema.methods.addFriend = function (userId) {
  if (!this.friends.includes(userId) && !this.blockedUsers.includes(userId)) {
    this.friends.push(userId);
  }
};

userSchema.methods.removeFriend = function (userId) {
  this.friends = this.friends.filter(id => !id.equals(userId));
};

userSchema.methods.updateTier = function () {
  const oldTier = this.loyaltyTier;
  const newTier = this.rank; // Using virtual rank
  
  if (oldTier !== newTier) {
    this.loyaltyTier = newTier;
    this.tierAchievedDate = new Date();
    return { upgraded: true, oldTier, newTier };
  }
  return { upgraded: false };
};

userSchema.methods.addPoints = function (points, source = 'booking') {
  this.rewardPoints += points;
  this.lifetimePoints += points;
  
  // Update tier if necessary
  const tierUpdate = this.updateTier();
  
  return {
    pointsAdded: points,
    totalPoints: this.rewardPoints,
    lifetimePoints: this.lifetimePoints,
    ...tierUpdate
  };
};

userSchema.methods.usePoints = function (points) {
  if (this.rewardPoints >= points) {
    this.rewardPoints -= points;
    return { success: true, remainingPoints: this.rewardPoints };
  }
  return { success: false, error: 'Insufficient points' };
};

userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

userSchema.methods.generateEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(20).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verificationToken;
};

// --- MIDDLEWARES ---
userSchema.pre("save", async function (next) {
  // Hash password if modified
  if (this.isModified("password") && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Generate referral code if new user and doesn't have one
  if (this.isNew && !this.referralCode) {
    let code;
    let exists = true;
    while (exists) {
      code = this.constructor.generateReferralCode();
      exists = await this.constructor.findOne({ referralCode: code });
    }
    this.referralCode = code;
  }
  
  // Update primaryRole based on active roles
  const activeRoles = this.roles.filter(role => role.isActive);
  if (activeRoles.length > 0) {
    // Priority: admin > owner > coach > customer
    const priority = ['admin', 'owner', 'coach', 'customer'];
    for (const role of priority) {
      if (activeRoles.some(r => r.type === role)) {
        this.primaryRole = role;
        break;
      }
    }
  }
  
  next();
});

// Update lastSeen when user is active
userSchema.pre(/^find/, function (next) {
  if (this.getUpdate() && this.getUpdate().isOnline) {
    this.getUpdate().lastSeen = new Date();
  }
  next();
});

userSchema.plugin(mongoose_delete, { 
  overrideMethods: "all",
  deletedAt: true,
  deletedBy: true
});

const User = mongoose.model("User", userSchema);

export default User;