import express from "express";
import {
  createDirectChat,
  createGroupChat,
  getUserChats,
  getChatMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
  editMessage,
  getUnreadCount,
  getOnlineUsers,
  addReaction,
  removeReaction,
  addParticipant,
  removeParticipant,
} from "../controllers/chat.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);
router.use(authorize("customer", "coach", "owner", "admin"));

// Chat management
router.post("/direct", createDirectChat);
router.post("/group", createGroupChat);
router.get("/", getUserChats);
router.get("/unread-count", getUnreadCount);
router.get("/online-users", getOnlineUsers);

// Chat messages
router.get("/:chatId/messages", getChatMessages);
router.post("/:chatId/messages", sendMessage);
router.put("/:chatId/read", markMessagesAsRead);

// Group chat participants
router.post("/:chatId/participants", addParticipant);
router.delete("/:chatId/participants/:participantId", removeParticipant);

// Message actions
router.delete("/messages/:messageId", deleteMessage);
router.put("/messages/:messageId", editMessage);
router.post("/messages/:messageId/reaction", addReaction);
router.delete("/messages/:messageId/reaction", removeReaction);

export default router;
