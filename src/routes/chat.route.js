import express from "express";
import {
  createDirectChat,
  getUserChats,
  getChatMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
  editMessage,
  getUnreadCount,
  getOnlineUsers,
} from "../controllers/chat.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);
router.use(authorize("customer", "coach", "owner", "admin"));

router.post("/direct", createDirectChat);
router.get("/", getUserChats);
router.get("/:chatId/messages", getChatMessages);
router.post("/:chatId/messages", sendMessage);
router.put("/:chatId/read", markMessagesAsRead);
router.delete("/messages/:messageId", deleteMessage);
router.put("/messages/:messageId", editMessage);
router.get("/unread-count", getUnreadCount);
router.get("/online-users", getOnlineUsers);

export default router;
