const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    // --- Thông tin cơ bản ---
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Chat name cannot exceed 100 characters"]
    },
    type: {
      type: String,
      enum: {
        values: ["direct", "group"],
        message: "{VALUE} is not a valid chat type"
      },
      required: [true, "Chat type is required"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },

    // --- Thành viên ---
    participants: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      role: {
        type: String,
        enum: {
          values: ["member", "admin", "owner"],
          message: "{VALUE} is not a valid role"
        },
        default: "member"
      },
      joinedAt: {
        type: Date,
        default: Date.now
      },
      lastSeen: {
        type: Date,
        default: Date.now
      },
      isActive: {
        type: Boolean,
        default: true
      },
      muted: {
        type: Boolean,
        default: false
      },
      notificationSettings: {
        enabled: {
          type: Boolean,
          default: true
        },
        sound: {
          type: Boolean,
          default: true
        },
        vibration: {
          type: Boolean,
          default: true
        }
      }
    }],

    // --- Thông tin nhóm (chỉ cho group chat) ---
    groupInfo: {
      avatar: {
        type: String
      },
      coverImage: {
        type: String
      },
      maxParticipants: {
        type: Number,
        min: [2, "Minimum participants is 2"],
        max: [1000, "Maximum participants is 1000"],
        default: 100
      },
      isPublic: {
        type: Boolean,
        default: false
      },
      inviteLink: {
        type: String,
        unique: true,
        sparse: true
      },
      rules: {
        type: [String],
        default: []
      },
      tags: {
        type: [String],
        default: []
      }
    },

    // --- Tin nhắn cuối cùng ---
    lastMessage: {
      content: {
        type: String,
        trim: true
      },
      type: {
        type: String,
        enum: ["text", "image", "video", "audio", "file", "location", "contact"],
        default: "text"
      },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      sentAt: {
        type: Date
      },
      isEdited: {
        type: Boolean,
        default: false
      },
      isDeleted: {
        type: Boolean,
        default: false
      }
    },

    // --- Thống kê ---
    stats: {
      totalMessages: {
        type: Number,
        default: 0
      },
      totalParticipants: {
        type: Number,
        default: 0
      },
      unreadCount: {
        type: Number,
        default: 0
      }
    },

    // --- Trạng thái ---
    status: {
      type: String,
      enum: {
        values: ["active", "archived", "deleted"],
        message: "{VALUE} is not a valid status"
      },
      default: "active"
    },

    // --- Cài đặt ---
    settings: {
      allowInvites: {
        type: Boolean,
        default: true
      },
      allowEditing: {
        type: Boolean,
        default: true
      },
      allowDeleting: {
        type: Boolean,
        default: true
      },
      allowForwarding: {
        type: Boolean,
        default: true
      },
      slowMode: {
        enabled: {
          type: Boolean,
          default: false
        },
        interval: {
          type: Number, // seconds
          min: 0,
          max: 3600
        }
      }
    },

    // --- Thông tin bổ sung ---
    metadata: {
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      relatedBooking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking"
      },
      relatedComplex: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Complex"
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
chatSchema.index({ type: 1 });
chatSchema.index({ status: 1 });
chatSchema.index({ "participants.user": 1 });
chatSchema.index({ "lastMessage.sentAt": 1 });
chatSchema.index({ createdAt: 1 });

// Compound indexes
chatSchema.index({ type: 1, status: 1 });
chatSchema.index({ "participants.user": 1, status: 1 });

// Virtual for chat display name
chatSchema.virtual("displayName").get(function () {
  if (this.name) return this.name;
  
  if (this.type === "direct" && this.participants.length === 2) {
    // For direct chats, show the other person's name
    return "Direct Chat"; // This will be populated with actual user names
  }
  
  return "Group Chat";
});

// Virtual for unread count for a specific user
chatSchema.virtual("unreadForUser").get(function () {
  return function(userId) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    return participant ? participant.unreadCount || 0 : 0;
  };
});

// Virtual for is user muted
chatSchema.virtual("isUserMuted").get(function () {
  return function(userId) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    return participant ? participant.muted : false;
  };
});

// Virtual for can user send message
chatSchema.virtual("canUserSendMessage").get(function () {
  return function(userId) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    if (!participant || !participant.isActive) return false;
    
    if (this.settings.slowMode.enabled) {
      const lastMessage = this.lastMessage;
      if (lastMessage && lastMessage.sender.toString() === userId.toString()) {
        const timeDiff = Date.now() - lastMessage.sentAt.getTime();
        return timeDiff >= (this.settings.slowMode.interval * 1000);
      }
    }
    
    return true;
  };
});

// Pre-save middleware
chatSchema.pre("save", function (next) {
  // Update total participants count
  this.stats.totalParticipants = this.participants.length;
  
  // Generate invite link for group chats if not exists
  if (this.type === "group" && !this.groupInfo.inviteLink) {
    this.groupInfo.inviteLink = `invite_${this._id}_${Date.now()}`;
  }
  
  // Validate participants count
  if (this.type === "direct" && this.participants.length !== 2) {
    return next(new Error("Direct chat must have exactly 2 participants"));
  }
  
  if (this.type === "group" && this.participants.length > this.groupInfo.maxParticipants) {
    return next(new Error("Group participants exceed maximum limit"));
  }
  
  next();
});

// Method to add participant
chatSchema.methods.addParticipant = async function (userId, role = "member") {
  const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
  
  if (existingParticipant) {
    return { success: false, message: "User is already a participant" };
  }
  
  if (this.type === "group" && this.participants.length >= this.groupInfo.maxParticipants) {
    return { success: false, message: "Group is full" };
  }
  
  this.participants.push({
    user: userId,
    role,
    joinedAt: new Date(),
    lastSeen: new Date(),
    isActive: true,
    muted: false,
    notificationSettings: {
      enabled: true,
      sound: true,
      vibration: true
    }
  });
  
  await this.save();
  return { success: true, message: "Participant added successfully" };
};

// Method to remove participant
chatSchema.methods.removeParticipant = async function (userId) {
  const participantIndex = this.participants.findIndex(p => p.user.toString() === userId.toString());
  
  if (participantIndex === -1) {
    return { success: false, message: "User is not a participant" };
  }
  
  this.participants.splice(participantIndex, 1);
  
  // If no participants left, archive the chat
  if (this.participants.length === 0) {
    this.status = "archived";
  }
  
  await this.save();
  return { success: true, message: "Participant removed successfully" };
};

// Method to update last message
chatSchema.methods.updateLastMessage = async function (message) {
  this.lastMessage = {
    content: message.content,
    type: message.type,
    sender: message.sender,
    sentAt: message.sentAt || new Date(),
    isEdited: message.isEdited || false,
    isDeleted: message.isDeleted || false
  };
  
  this.stats.totalMessages += 1;
  
  // Update unread count for other participants
  this.participants.forEach(participant => {
    if (participant.user.toString() !== message.sender.toString()) {
      participant.unreadCount = (participant.unreadCount || 0) + 1;
    }
  });
  
  await this.save();
};

// Method to mark messages as read for a user
chatSchema.methods.markAsRead = async function (userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  
  if (participant) {
    participant.unreadCount = 0;
    participant.lastSeen = new Date();
    await this.save();
  }
};

// Method to mute/unmute user
chatSchema.methods.toggleMute = async function (userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  
  if (participant) {
    participant.muted = !participant.muted;
    await this.save();
    return { success: true, muted: participant.muted };
  }
  
  return { success: false, message: "User not found" };
};

// Static method to get user chats
chatSchema.statics.getUserChats = async function (userId, options = {}) {
  const { limit = 20, offset = 0, type } = options;
  
  const query = {
    "participants.user": userId,
    status: "active"
  };
  
  if (type) {
    query.type = type;
  }
  
  return await this.find(query)
    .sort({ "lastMessage.sentAt": -1, updatedAt: -1 })
    .skip(offset)
    .limit(limit)
    .populate("participants.user", "fullName username avatar")
    .populate("lastMessage.sender", "fullName username avatar");
};

const Chat = mongoose.model("Chat", chatSchema);

export default Chat; 