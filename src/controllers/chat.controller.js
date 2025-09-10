import Chat from "../models/chat.js";
import Message from "../models/message.js";
import User from "../models/user.js";

// @desc    Create or Get Direct Chat
// @route   POST /api/chats/direct
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

    // Check if direct chat already exists
    let chat = await Chat.findOne({
      type: "direct",
      participants: { $all: [userId, participantId] },
    }).populate("participants", "fullName avatar isOnline lastSeen");

    if (!chat) {
      // Create new direct chat
      chat = await Chat.create({
        participants: [userId, participantId],
        type: "direct",
        createdBy: userId,
      });

      await chat.populate("participants", "fullName avatar isOnline lastSeen");
    }

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

// @desc    Get User Chats
// @route   GET /api/chats
// @access Private
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const chats = await Chat.find({
      participants: userId,
      isActive: true,
    })
      .populate("participants", "fullName avatar isOnline lastSeen")
      .populate("lastMessage.senderId", "fullName avatar")
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Chat.countDocuments({
      participants: userId,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: {
        chats,
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
// @route   GET /api/chats/:chatId/messages
// @access Private
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;

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

    const messages = await Message.find({
      chatId,
      isDeleted: false,
    })
      .populate("senderId", "fullName avatar")
      .populate("replyTo", "content senderId")
      .sort({ sentAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

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
// @route   POST /api/chats/:chatId/messages
// @access Private
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const senderId = req.user.id;
    const { content, type = "text", replyTo } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
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

    // Create message
    const message = await Message.create({
      chatId,
      senderId,
      content,
      type,
      replyTo,
    });

    // Update chat last message
    chat.lastMessage = {
      senderId,
      content,
      type,
      sentAt: message.sentAt,
    };
    await chat.save();

    // Mark as delivered to all participants except sender
    const otherParticipants = chat.participants.filter(id => !id.equals(senderId));
    message.deliveredTo = otherParticipants.map(participantId => ({
      userId: participantId,
      deliveredAt: new Date(),
    }));
    await message.save();

    await message.populate("senderId", "fullName avatar");
    if (replyTo) {
      await message.populate("replyTo", "content senderId");
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
// @route   PUT /api/chats/:chatId/read
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
    await Message.updateMany(
      {
        chatId,
        senderId: { $ne: userId },
        "readBy.userId": { $ne: userId },
      },
      {
        $push: {
          readBy: {
            userId,
            readAt: new Date(),
          },
        },
      }
    );

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
// @route   DELETE /api/messages/:messageId
// @access Private
export const deleteMessage = async (req, res) => {
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

    // Check if user is the sender
    if (!message.senderId.equals(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this message",
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    await message.save();

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
// @route   PUT /api/messages/:messageId
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

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

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
// @route   GET /api/chats/unread-count
// @access Private
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await Message.countDocuments({
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
// @route   GET /api/chats/online-users
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
