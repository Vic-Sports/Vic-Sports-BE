import Chat from "../models/chat.js";
import Message from "../models/message.js";
import User from "../models/user.js";

// @desc    Create or Get Direct Chat
// @route   POST /api/v1/chats/direct
// @access Private
export const createDirectChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: "Participant ID is required",
      });
    }

    if (userId === participantId) {
      return res.status(400).json({
        success: false,
        message: "Cannot create chat with yourself",
      });
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    // Find or create direct chat
    const chat = await Chat.findOrCreateDirectChat(userId, participantId);
    await chat.populate("participants", "fullName avatar isOnline lastSeen");
    await chat.populate("lastMessage.senderId", "fullName avatar");

    res.status(200).json({
      success: true,
      data: {
        chat,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create Group Chat
// @route   POST /api/v1/chats/group
// @access Private
export const createGroupChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, participantIds, avatar } = req.body;

    if (!name || !participantIds || participantIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Name and participants are required",
      });
    }

    // Add creator to participants
    const allParticipants = [userId, ...participantIds];
    
    // Remove duplicates
    const uniqueParticipants = [...new Set(allParticipants.map(id => id.toString()))];

    // Create group chat
    const chat = await Chat.create({
      participants: uniqueParticipants,
      type: "group",
      name,
      description,
      avatar,
      isGroup: true,
      createdBy: userId,
      admins: [userId] // Creator is admin
    });

    await chat.populate("participants", "fullName avatar isOnline lastSeen");
    await chat.populate("admins", "fullName avatar");
    await chat.populate("createdBy", "fullName avatar");

    // Create system message
    await Message.create({
      chatId: chat._id,
      senderId: userId,
      content: `Created group "${name}"`,
      type: "system",
      systemData: {
        type: "chat_created",
        data: { groupName: name, createdBy: userId }
      }
    });

    res.status(201).json({
      success: true,
      data: {
        chat,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get User Chats
// @route   GET /api/v1/chats
// @access Private
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type } = req.query;

    const chats = await Chat.findUserChats(userId, { page, limit, type });

    const total = await Chat.countDocuments({
      participants: userId,
      isActive: true,
      ...(type && { type })
    });

    // Get unread counts for each chat
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.getUnreadCount(chat._id, userId);
        return {
          ...chat.toObject(),
          unreadCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        chats: chatsWithUnreadCount,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalChats: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Chat Messages
// @route   GET /api/v1/chats/:chatId/messages
// @access Private
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50, before } = req.query;

    // Check if user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    if (!chat.participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this chat",
      });
    }

    const messages = await Message.getChatMessages(chatId, { page, limit, before });
    const total = await Message.countDocuments({
      chatId,
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(), // Show oldest first
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalMessages: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Send Message
// @route   POST /api/v1/chats/:chatId/messages
// @access Private
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const senderId = req.user.id;
    const { content, type = "text", replyTo, attachments, priority = "normal" } = req.body;

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Message content or attachments are required",
      });
    }

    // Check if user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    if (!chat.participants.includes(senderId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to send messages in this chat",
      });
    }

    // Prepare message data
    const messageData = {
      chatId,
      senderId,
      content: content || "",
      type,
      priority,
      attachments: attachments || []
    };

    // Handle reply
    if (replyTo) {
      const replyMessage = await Message.findById(replyTo);
      if (replyMessage) {
        messageData.replyTo = replyTo;
        messageData.replyPreview = {
          content: replyMessage.content,
          senderName: replyMessage.senderId.fullName,
          messageType: replyMessage.type
        };
      }
    }

    // Create message
    const message = await Message.create(messageData);

    // Update chat last message
    chat.updateLastMessage(message);
    await chat.save();

    // Mark as delivered to all participants except sender
    const otherParticipants = chat.participants.filter(id => !id.equals(senderId));
    message.deliveredTo = otherParticipants.map(participantId => ({
      userId: participantId,
      deliveredAt: new Date(),
    }));
    await message.save();

    // Populate message data
    await message.populate("senderId", "fullName avatar");
    if (replyTo) {
      await message.populate("replyTo", "content senderId type");
      await message.populate("replyTo.senderId", "fullName");
    }

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: {
        message,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Mark Messages as Read
// @route   PUT /api/v1/chats/:chatId/read
// @access Private
export const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Check if user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    if (!chat.participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to mark messages as read in this chat",
      });
    }

    // Mark all unread messages as read
    await Message.markAsRead(chatId, userId);

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete Message
// @route   DELETE /api/v1/messages/:messageId
// @access Private
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const { reason = "" } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check if user is the sender or admin
    const chat = await Chat.findById(message.chatId);
    const isAdmin = chat.isAdmin(userId);
    
    if (!message.senderId.equals(userId) && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this message",
      });
    }

    await message.softDelete(userId, reason);

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Edit Message
// @route   PUT /api/v1/messages/:messageId
// @access Private
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check if user is the sender
    if (!message.senderId.equals(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to edit this message",
      });
    }

    await message.editMessage(content, userId);
    await message.populate("senderId", "fullName avatar");

    res.status(200).json({
      success: true,
      message: "Message edited successfully",
      data: {
        message,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Unread Message Count
// @route   GET /api/v1/chats/unread-count
// @access Private
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all chats for user
    const userChats = await Chat.find({
      participants: userId,
      isActive: true
    }).select('_id');

    const chatIds = userChats.map(chat => chat._id);

    const unreadCount = await Message.countDocuments({
      chatId: { $in: chatIds },
      senderId: { $ne: userId },
      "readBy.userId": { $ne: userId },
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Online Users
// @route   GET /api/v1/chats/online-users
// @access Private
export const getOnlineUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const onlineUsers = await User.find({
      isOnline: true,
      _id: { $ne: userId },
    }).select("fullName avatar isOnline lastSeen");

    res.status(200).json({
      success: true,
      data: {
        onlineUsers,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Add Reaction to Message
// @route   POST /api/v1/messages/:messageId/reaction
// @access Private
export const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: "Emoji is required",
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check if user is participant in chat
    const chat = await Chat.findById(message.chatId);
    if (!chat.participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to react to this message",
      });
    }

    await message.addReaction(userId, emoji);
    await message.populate("senderId", "fullName avatar");

    res.status(200).json({
      success: true,
      message: "Reaction added successfully",
      data: {
        message,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Remove Reaction from Message
// @route   DELETE /api/v1/messages/:messageId/reaction
// @access Private
export const removeReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check if user is participant in chat
    const chat = await Chat.findById(message.chatId);
    if (!chat.participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to remove reaction from this message",
      });
    }

    await message.removeReaction(userId);
    await message.populate("senderId", "fullName avatar");

    res.status(200).json({
      success: true,
      message: "Reaction removed successfully",
      data: {
        message,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Add Participant to Group Chat
// @route   POST /api/v1/chats/:chatId/participants
// @access Private
export const addParticipant = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: "Participant ID is required",
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Check if user is admin
    if (!chat.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to add participants",
      });
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    chat.addParticipant(participantId);
    await chat.save();

    // Create system message
    await Message.create({
      chatId: chat._id,
      senderId: userId,
      content: `${participant.fullName} was added to the group`,
      type: "system",
      systemData: {
        type: "user_joined",
        data: { userId: participantId, addedBy: userId }
      }
    });

    await chat.populate("participants", "fullName avatar isOnline lastSeen");

    res.status(200).json({
      success: true,
      message: "Participant added successfully",
      data: {
        chat,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Remove Participant from Group Chat
// @route   DELETE /api/v1/chats/:chatId/participants/:participantId
// @access Private
export const removeParticipant = async (req, res) => {
  try {
    const { chatId, participantId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Check if user is admin or removing themselves
    if (!chat.isAdmin(userId) && userId !== participantId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to remove participants",
      });
    }

    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    chat.removeParticipant(participantId);
    await chat.save();

    // Create system message
    await Message.create({
      chatId: chat._id,
      senderId: userId,
      content: `${participant.fullName} left the group`,
      type: "system",
      systemData: {
        type: "user_left",
        data: { userId: participantId, removedBy: userId }
      }
    });

    await chat.populate("participants", "fullName avatar isOnline lastSeen");

    res.status(200).json({
      success: true,
      message: "Participant removed successfully",
      data: {
        chat,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
