const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // --- Quan hệ với Chat và User ---
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: [true, "Chat is required"]
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender is required"]
    },

    // --- Nội dung tin nhắn ---
    type: {
      type: String,
      enum: {
        values: ["text", "image", "video", "audio", "file", "location", "contact", "system"],
        message: "{VALUE} is not a valid message type"
      },
      required: [true, "Message type is required"]
    },
    content: {
      type: String,
      trim: true,
      maxlength: [5000, "Message content cannot exceed 5000 characters"]
    },

    // --- Media content ---
    media: {
      url: {
        type: String
      },
      thumbnail: {
        type: String
      },
      filename: {
        type: String
      },
      size: {
        type: Number, // bytes
        min: 0
      },
      duration: {
        type: Number, // seconds for audio/video
        min: 0
      },
      mimeType: {
        type: String
      },
      dimensions: {
        width: {
          type: Number,
          min: 0
        },
        height: {
          type: Number,
          min: 0
        }
      }
    },

    // --- Location content ---
    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      },
      address: {
        type: String,
        trim: true
      },
      name: {
        type: String,
        trim: true
      }
    },

    // --- Contact content ---
    contact: {
      name: {
        type: String,
        trim: true
      },
      phone: {
        type: String,
        trim: true
      },
      email: {
        type: String,
        trim: true
      },
      avatar: {
        type: String
      }
    },

    // --- Trạng thái tin nhắn ---
    status: {
      type: String,
      enum: {
        values: ["sent", "delivered", "read", "failed"],
        message: "{VALUE} is not a valid message status"
      },
      default: "sent"
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    isForwarded: {
      type: Boolean,
      default: false
    },
    originalMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message"
    },

    // --- Thông tin đọc ---
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }],

    // --- Tương tác ---
    reactions: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      emoji: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],

    // --- Reply information ---
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message"
    },
    replyContent: {
      type: String,
      trim: true
    },

    // --- Thông tin bổ sung ---
    metadata: {
      clientMessageId: {
        type: String
      },
      deviceInfo: {
        type: String
      },
      ipAddress: {
        type: String
      }
    },

    // --- Thống kê ---
    stats: {
      viewCount: {
        type: Number,
        default: 0
      },
      forwardCount: {
        type: Number,
        default: 0
      },
      reactionCount: {
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
messageSchema.index({ chat: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ createdAt: 1 });
messageSchema.index({ type: 1 });
messageSchema.index({ status: 1 });
messageSchema.index({ isDeleted: 1 });

// Compound indexes
messageSchema.index({ chat: 1, createdAt: 1 });
messageSchema.index({ chat: 1, isDeleted: 1 });
messageSchema.index({ sender: 1, createdAt: 1 });

// Virtual for formatted time
messageSchema.virtual("formattedTime").get(function () {
  return this.createdAt.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for formatted date
messageSchema.virtual("formattedDate").get(function () {
  const now = new Date();
  const messageDate = this.createdAt;
  
  if (messageDate.toDateString() === now.toDateString()) {
    return "Hôm nay";
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (messageDate.toDateString() === yesterday.toDateString()) {
    return "Hôm qua";
  }
  
  return messageDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
});

// Virtual for message summary
messageSchema.virtual("summary").get(function () {
  if (this.type === "text") {
    return this.content?.substring(0, 50) + (this.content?.length > 50 ? "..." : "");
  }
  
  const typeLabels = {
    image: "📷 Hình ảnh",
    video: "🎥 Video",
    audio: "🎵 Âm thanh",
    file: "📎 Tệp tin",
    location: "📍 Vị trí",
    contact: "👤 Liên hệ",
    system: "ℹ️ Thông báo"
  };
  
  return typeLabels[this.type] || "Tin nhắn";
});

// Virtual for is read by user
messageSchema.virtual("isReadByUser").get(function () {
  return function(userId) {
    return this.readBy.some(read => read.user.toString() === userId.toString());
  };
});

// Virtual for user reaction
messageSchema.virtual("userReaction").get(function () {
  return function(userId) {
    const reaction = this.reactions.find(r => r.user.toString() === userId.toString());
    return reaction ? reaction.emoji : null;
  };
});

// Virtual for can be edited
messageSchema.virtual("canBeEdited").get(function () {
  const now = new Date();
  const timeDiff = now.getTime() - this.createdAt.getTime();
  const hoursDiff = timeDiff / (1000 * 3600);
  
  return !this.isDeleted && hoursDiff <= 24; // Can edit within 24 hours
});

// Pre-save middleware
messageSchema.pre("save", function (next) {
  // Validate content based on type
  if (this.type === "text" && (!this.content || this.content.trim().length === 0)) {
    return next(new Error("Text message must have content"));
  }
  
  if (this.type === "image" && !this.media?.url) {
    return next(new Error("Image message must have media URL"));
  }
  
  if (this.type === "video" && !this.media?.url) {
    return next(new Error("Video message must have media URL"));
  }
  
  if (this.type === "audio" && !this.media?.url) {
    return next(new Error("Audio message must have media URL"));
  }
  
  if (this.type === "file" && !this.media?.url) {
    return next(new Error("File message must have media URL"));
  }
  
  if (this.type === "location" && (!this.location?.latitude || !this.location?.longitude)) {
    return next(new Error("Location message must have coordinates"));
  }
  
  if (this.type === "contact" && (!this.contact?.name || !this.contact?.phone)) {
    return next(new Error("Contact message must have name and phone"));
  }
  
  // Update reaction count
  this.stats.reactionCount = this.reactions.length;
  
  next();
});

// Method to mark as read
messageSchema.methods.markAsRead = async function (userId) {
  const existingRead = this.readBy.find(read => read.user.toString() === userId.toString());
  
  if (!existingRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    
    this.status = "read";
    await this.save();
  }
};

// Method to add reaction
messageSchema.methods.addReaction = async function (userId, emoji) {
  const existingReaction = this.reactions.find(r => r.user.toString() === userId.toString());
  
  if (existingReaction) {
    // Update existing reaction
    existingReaction.emoji = emoji;
    existingReaction.createdAt = new Date();
  } else {
    // Add new reaction
    this.reactions.push({
      user: userId,
      emoji,
      createdAt: new Date()
    });
  }
  
  this.stats.reactionCount = this.reactions.length;
  await this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = async function (userId) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  this.stats.reactionCount = this.reactions.length;
  await this.save();
};

// Method to edit message
messageSchema.methods.editMessage = async function (newContent) {
  if (!this.canBeEdited) {
    throw new Error("Message cannot be edited after 24 hours");
  }
  
  this.content = newContent;
  this.isEdited = true;
  await this.save();
};

// Method to delete message
messageSchema.methods.deleteMessage = async function () {
  this.isDeleted = true;
  this.content = "Tin nhắn đã bị xóa";
  await this.save();
};

// Method to forward message
messageSchema.methods.forwardMessage = async function (targetChatId, senderId) {
  const Message = mongoose.model("Message");
  
  const forwardedMessage = new Message({
    chat: targetChatId,
    sender: senderId,
    type: this.type,
    content: this.content,
    media: this.media,
    location: this.location,
    contact: this.contact,
    isForwarded: true,
    originalMessage: this._id
  });
  
  await forwardedMessage.save();
  
  // Update forward count
  this.stats.forwardCount += 1;
  await this.save();
  
  return forwardedMessage;
};

// Static method to get chat messages
messageSchema.statics.getChatMessages = async function (chatId, options = {}) {
  const { limit = 50, offset = 0, before, after } = options;
  
  const query = {
    chat: chatId,
    isDeleted: false
  };
  
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }
  
  if (after) {
    query.createdAt = { $gt: new Date(after) };
  }
  
  return await this.find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .populate("sender", "fullName avatar")
    .populate("replyTo", "content sender")
    .populate("readBy.user", "fullName avatar")
    .populate("reactions.user", "fullName avatar");
};

// Static method to search messages
messageSchema.statics.searchMessages = async function (chatId, searchTerm, options = {}) {
  const { limit = 20, offset = 0 } = options;
  
  const query = {
    chat: chatId,
    isDeleted: false,
    $or: [
      { content: { $regex: searchTerm, $options: 'i' } },
      { "contact.name": { $regex: searchTerm, $options: 'i' } },
      { "contact.phone": { $regex: searchTerm, $options: 'i' } }
    ]
  };
  
  return await this.find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .populate("sender", "fullName avatar");
};

const Message = mongoose.model("Message", messageSchema);

export default Message; 