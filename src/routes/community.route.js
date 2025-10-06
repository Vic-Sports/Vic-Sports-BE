import express from "express";
import {
  getCommunityStats,
  getBadges,
  getPopularSports,
  getRecentActivity,
} from "../controllers/community.controller.js";

const router = express.Router();

// Public routes
router.get("/stats", getCommunityStats);
router.get("/badges", getBadges);
router.get("/popular-sports", getPopularSports);
router.get("/recent-activity", getRecentActivity);

export default router;
