import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    content: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: [2000, "Message content cannot exceed 2000 characters"]
    },
    type: { 
      type: String, 
      enum: ["text", "image", "file", "system", "emoji"], 
      default: "text" 
    },
    
    // File attachments
    attachments: [{
      fileUrl: String,
      fileName: String,
      fileSize: Number,
      fileType: String,
      thumbnailUrl: String
    }],

    // Message status tracking
    deliveredTo: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        deliveredAt: { type: Date, default: Date.now }
      }
    ],
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now }
      }
    ],

    // Reply functionality
    replyTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Message",
      index: true
    },
    replyPreview: {
      content: String,
      senderName: String,
      messageType: String
    },

    // Message editing
    isEdited: { type: Boolean, default: false },
    editedAt: Date,
    originalContent: String,

    // Message deletion
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deleteReason: String,

    // Message reactions
    reactions: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      emoji: { type: String, required: true },
      addedAt: { type: Date, default: Date.now }
    }],

    // Message forwarding
    forwardedFrom: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
      chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
      forwardedAt: { type: Date, default: Date.now }
    },

    // System messages
    systemData: {
      type: {
        type: String,
        enum: ['user_joined', 'user_left', 'chat_created', 'chat_updated', 'admin_added', 'admin_removed']
      },
      data: mongoose.Schema.Types.Mixed
    },

    // Message metadata
    sentAt: { type: Date, default: Date.now },
    editedAt: Date,
    
    // Message priority (for important messages)
    priority: {
      type: String,
      enum: ['normal', 'high', 'urgent'],
      default: 'normal'
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
messageSchema.index({ chatId: 1, sentAt: -1 });
messageSchema.index({ senderId: 1, sentAt: -1 });
messageSchema.index({ replyTo: 1 });
messageSchema.index({ isDeleted: 1, sentAt: -1 });
messageSchema.index({ type: 1, sentAt: -1 });

// Virtual for reaction counts
messageSchema.virtual('reactionCounts').get(function() {
  const counts = {};
  this.reactions.forEach(reaction => {
    counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
  });
  return counts;
});

// Virtual for formatted time
messageSchema.virtual('formattedTime').get(function() {
  return this.sentAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
});

// Static methods
messageSchema.statics.getChatMessages = function(chatId, options = {}) {
  const { page = 1, limit = 50, before } = options;
  
  let query = {
    chatId,
    isDeleted: false
  };
  
  if (before) {
    query.sentAt = { $lt: new Date(before) };
  }
  
  return this.find(query)
    .populate('senderId', 'fullName avatar')
    .populate('replyTo', 'content senderId type')
    .populate('replyTo.senderId', 'fullName')
    .populate('deletedBy', 'fullName')
    .sort({ sentAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

messageSchema.statics.getUnreadCount = function(chatId, userId) {
  return this.countDocuments({
    chatId,
    senderId: { $ne: userId },
    'readBy.userId': { $ne: userId },
    isDeleted: false
  });
};

messageSchema.statics.markAsRead = function(chatId, userId) {
  return this.updateMany(
    {
      chatId,
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId },
      isDeleted: false
    },
    {
      $push: {
        readBy: {
          userId,
          readAt: new Date()
        }
      }
    }
  );
};

messageSchema.statics.markAsDelivered = function(chatId, userId) {
  return this.updateMany(
    {
      chatId,
      senderId: { $ne: userId },
      'deliveredTo.userId': { $ne: userId },
      isDeleted: false
    },
    {
      $push: {
        deliveredTo: {
          userId,
          deliveredAt: new Date()
        }
      }
    }
  );
};

// Instance methods
messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => !r.userId.equals(userId));
  
  // Add new reaction
  this.reactions.push({ userId, emoji });
  return this.save();
};

messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => !r.userId.equals(userId));
  return this.save();
};

messageSchema.methods.editMessage = function(newContent, userId) {
  if (!this.isEdited) {
    this.originalContent = this.content;
  }
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

messageSchema.methods.softDelete = function(userId, reason = '') {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.deleteReason = reason;
  return this.save();
};

messageSchema.methods.forward = function(targetChatId, forwardedBy) {
  return this.constructor.create({
    chatId: targetChatId,
    senderId: forwardedBy,
    content: this.content,
    type: this.type,
    attachments: this.attachments,
    forwardedFrom: {
      messageId: this._id,
      chatId: this.chatId,
      forwardedAt: new Date()
    }
  });
};

// Pre-save middleware
messageSchema.pre('save', function(next) {
  // Set edited timestamp if content is modified
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  
  next();
});

const Message = mongoose.model("Message", messageSchema);

export default Message;
