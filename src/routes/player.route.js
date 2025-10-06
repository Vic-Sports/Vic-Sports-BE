import express from "express";
import {
  getOnlinePlayersCount,
  getLivePlayers,
  getPlayerProfile,
  sendMessageToPlayer,
  searchPlayers,
  getPlayerStats,
  updatePlayerStatus,
} from "../controllers/player.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/online-count", getOnlinePlayersCount);
router.get("/live", getLivePlayers);
router.get("/search", searchPlayers);
router.get("/stats", getPlayerStats);
router.get("/:id/profile", getPlayerProfile);

// Protected routes
router.use(protect);

// User routes
router.post("/:id/message", sendMessageToPlayer);
router.put("/status", updatePlayerStatus);

export default router;
