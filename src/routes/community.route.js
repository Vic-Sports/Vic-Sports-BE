import express from "express";
import {
  getCommunityStats,
  getBadges,
  getPopularSports,
  getRecentActivity,
  createCommunityPost,
  getAllCommunityPosts,
  joinCommunityPost,
  cancelCommunityPost,
  closeCommunityPost,
  getSingleCommunityPost,
  toggleLikeCommunityPost,
  acceptCommunityPost,
  rejectCommunityPost,
  checkRejectionStatus,
} from "../controllers/community.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/stats", getCommunityStats);
router.get("/badges", getBadges);
router.get("/popular-sports", getPopularSports);
router.get("/recent-activity", getRecentActivity);

// Community Post Routes
router.post("/posts", protect, createCommunityPost); // Alias route for creating a community post
router.get("/", getAllCommunityPosts);
router.post("/:id/join", joinCommunityPost);
router.patch("/:id/cancel", cancelCommunityPost);
router.patch("/:id/close", closeCommunityPost);
router.get("/:id", getSingleCommunityPost);
router.post("/:id/like", protect, toggleLikeCommunityPost);
router.patch("/:id/accept", protect, acceptCommunityPost);
router.patch("/:id/reject", protect, rejectCommunityPost);
// Check rejection status
router.get("/:postId/request-status/:userId", protect, checkRejectionStatus);

export default router;
