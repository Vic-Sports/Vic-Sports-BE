const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // --- Quan hệ với User và các đối tượng được đánh giá ---
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"]
    },
    complex: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complex"
    },
    subField: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubField"
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking"
    },

    // --- Thông tin đánh giá ---
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"]
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"]
    },
    content: {
      type: String,
      required: [true, "Review content is required"],
      trim: true,
      maxlength: [2000, "Review content cannot exceed 2000 characters"]
    },

    // --- Đánh giá chi tiết ---
    categories: {
      facility: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
      },
      service: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
      },
      cleanliness: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
      },
      value: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
      },
      location: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
      }
    },

    // --- Hình ảnh và media ---
    images: {
      type: [String],
      default: []
    },
    videos: {
      type: [String],
      default: []
    },

    // --- Trạng thái và kiểm duyệt ---
    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected", "hidden"],
        message: "{VALUE} is not a valid status"
      },
      default: "pending"
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    isAnonymous: {
      type: Boolean,
      default: false
    },

    // --- Tương tác ---
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    dislikes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    helpful: {
      type: Number,
      default: 0
    },
    notHelpful: {
      type: Number,
      default: 0
    },

    // --- Phản hồi từ chủ sở hữu ---
    ownerReply: {
      content: {
        type: String,
        trim: true,
        maxlength: [1000, "Reply content cannot exceed 1000 characters"]
      },
      repliedAt: {
        type: Date
      },
      repliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    },

    // --- Thông tin bổ sung ---
    tags: {
      type: [String],
      default: []
    },
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      default: "positive"
    },
    language: {
      type: String,
      default: "vi"
    },

    // --- Thống kê ---
    viewCount: {
      type: Number,
      default: 0
    },
    shareCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
reviewSchema.index({ user: 1 });
reviewSchema.index({ complex: 1 });
reviewSchema.index({ subField: 1 });
reviewSchema.index({ booking: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: 1 });
reviewSchema.index({ isVerified: 1 });

// Compound indexes
reviewSchema.index({ complex: 1, status: 1 });
reviewSchema.index({ subField: 1, status: 1 });
reviewSchema.index({ user: 1, createdAt: 1 });

// Virtual for average category rating
reviewSchema.virtual("averageCategoryRating").get(function () {
  const categories = this.categories;
  if (!categories) return this.rating;
  
  const values = Object.values(categories).filter(val => typeof val === 'number');
  if (values.length === 0) return this.rating;
  
  return Math.round((values.reduce((sum, val) => sum + val, 0) / values.length) * 10) / 10;
});

// Virtual for total interactions
reviewSchema.virtual("totalInteractions").get(function () {
  return this.likes.length + this.dislikes.length + this.helpful + this.notHelpful;
});

// Virtual for sentiment score
reviewSchema.virtual("sentimentScore").get(function () {
  const positive = this.likes.length + this.helpful;
  const negative = this.dislikes.length + this.notHelpful;
  const total = positive + negative;
  
  if (total === 0) return 0;
  return Math.round((positive / total) * 100);
});

// Virtual for formatted date
reviewSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for review summary
reviewSchema.virtual("summary").get(function () {
  if (this.content.length <= 100) return this.content;
  return this.content.substring(0, 100) + '...';
});

// Pre-save middleware to validate review
reviewSchema.pre("save", function (next) {
  // Ensure at least one target is specified
  if (!this.complex && !this.subField) {
    return next(new Error("Review must target either a complex or sub field"));
  }

  // Validate category ratings
  const categories = this.categories;
  if (categories) {
    for (const [key, value] of Object.entries(categories)) {
      if (typeof value === 'number' && (value < 1 || value > 5)) {
        return next(new Error(`Category ${key} rating must be between 1 and 5`));
      }
    }
  }

  // Auto-determine sentiment based on rating
  if (this.rating >= 4) {
    this.sentiment = "positive";
  } else if (this.rating <= 2) {
    this.sentiment = "negative";
  } else {
    this.sentiment = "neutral";
  }

  next();
});

// Method to like review
reviewSchema.methods.like = async function (userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
    // Remove from dislikes if exists
    this.dislikes = this.dislikes.filter(id => !id.equals(userId));
    await this.save();
  }
};

// Method to dislike review
reviewSchema.methods.dislike = async function (userId) {
  if (!this.dislikes.includes(userId)) {
    this.dislikes.push(userId);
    // Remove from likes if exists
    this.likes = this.likes.filter(id => !id.equals(userId));
    await this.save();
  }
};

// Method to mark as helpful
reviewSchema.methods.markHelpful = async function () {
  this.helpful += 1;
  await this.save();
};

// Method to mark as not helpful
reviewSchema.methods.markNotHelpful = async function () {
  this.notHelpful += 1;
  await this.save();
};

// Method to add owner reply
reviewSchema.methods.addOwnerReply = async function (content, ownerId) {
  this.ownerReply = {
    content,
    repliedAt: new Date(),
    repliedBy: ownerId
  };
  await this.save();
};

// Static method to get review statistics
reviewSchema.statics.getStats = async function (filters = {}) {
  const stats = await this.aggregate([
    { $match: { ...filters, status: "approved" } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: "$rating" },
        ratingDistribution: {
          $push: "$rating"
        },
        totalLikes: { $sum: { $size: "$likes" } },
        totalDislikes: { $sum: { $size: "$dislikes" } }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalLikes: 0,
      totalDislikes: 0
    };
  }

  const stat = stats[0];
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  stat.ratingDistribution.forEach(rating => {
    distribution[rating] = (distribution[rating] || 0) + 1;
  });

  return {
    totalReviews: stat.totalReviews,
    averageRating: Math.round(stat.averageRating * 10) / 10,
    ratingDistribution: distribution,
    totalLikes: stat.totalLikes,
    totalDislikes: stat.totalDislikes
  };
};

// Static method to get top reviews
reviewSchema.statics.getTopReviews = async function (filters = {}, limit = 10) {
  return await this.find({ ...filters, status: "approved" })
    .sort({ helpful: -1, rating: -1, createdAt: -1 })
    .limit(limit)
    .populate('user', 'fullName username avatar')
    .populate('complex', 'name')
    .populate('subField', 'name code');
};

const Review = mongoose.model("Review", reviewSchema);

export default Review; 