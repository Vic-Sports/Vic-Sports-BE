import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    ],
    type: { 
      type: String, 
      enum: ["direct", "group"], 
      default: "direct" 
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Chat name cannot exceed 100 characters"]
    },
    avatar: String,
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },

    // Last message info for quick access
    lastMessage: {
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      content: String,
      type: { type: String, enum: ["text", "image", "file", "system"], default: "text" },
      sentAt: Date
    },

    // Group chat specific fields
    isGroup: {
      type: Boolean,
      default: false
    },
    groupSettings: {
      isPublic: { type: Boolean, default: false },
      allowMemberInvite: { type: Boolean, default: true },
      maxMembers: { type: Number, default: 100 }
    },
    admins: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],

    // Chat status
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Message count for performance
    messageCount: { type: Number, default: 0 },

    // Pinned messages
    pinnedMessages: [{
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
      pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      pinnedAt: { type: Date, default: Date.now }
    }]
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });
chatSchema.index({ type: 1, isActive: 1 });
chatSchema.index({ "lastMessage.sentAt": -1 });
chatSchema.index({ createdBy: 1 });

// Virtual for participant count
chatSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Virtual for unread count (will be calculated in controller)
chatSchema.virtual('unreadCount').get(function() {
  return 0; // Will be populated by controller
});

// Static methods
chatSchema.statics.findUserChats = function(userId, options = {}) {
  const { page = 1, limit = 20, type } = options;
  
  let query = {
    participants: userId,
    isActive: true
  };
  
  if (type) {
    query.type = type;
  }
  
  return this.find(query)
    .populate('participants', 'fullName avatar isOnline lastSeen')
    .populate('lastMessage.senderId', 'fullName avatar')
    .populate('createdBy', 'fullName avatar')
    .sort({ 'lastMessage.sentAt': -1, updatedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

chatSchema.statics.findOrCreateDirectChat = function(userId1, userId2) {
  return this.findOne({
    type: 'direct',
    participants: { $all: [userId1, userId2] },
    isActive: true
  }).then(chat => {
    if (chat) return chat;
    
    return this.create({
      participants: [userId1, userId2],
      type: 'direct',
      createdBy: userId1
    });
  });
};

// Instance methods
chatSchema.methods.addParticipant = function(userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
  }
};

chatSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(id => !id.equals(userId));
  this.admins = this.admins.filter(id => !id.equals(userId));
};

chatSchema.methods.isAdmin = function(userId) {
  return this.admins.includes(userId) || this.createdBy.equals(userId);
};

chatSchema.methods.addAdmin = function(userId) {
  if (!this.admins.includes(userId) && this.participants.includes(userId)) {
    this.admins.push(userId);
  }
};

chatSchema.methods.removeAdmin = function(userId) {
  this.admins = this.admins.filter(id => !id.equals(userId));
};

chatSchema.methods.updateLastMessage = function(message) {
  this.lastMessage = {
    senderId: message.senderId,
    content: message.content,
    type: message.type || 'text',
    sentAt: message.sentAt || new Date()
  };
  this.messageCount += 1;
};

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;
