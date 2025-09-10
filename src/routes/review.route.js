import express from "express";
import {
  createReview,
  getReviewsByVenue,
  getReviewsByCourt,
  getUserReviews,
  updateReview,
  deleteReview,
  voteReview,
  respondToReview,
  getReviewStats,
} from "../controllers/review.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/venue/:venueId", getReviewsByVenue);
router.get("/court/:courtId", getReviewsByCourt);
router.get("/stats/:venueId", getReviewStats);

// Customer routes
router.use(protect);
router.use(authorize("customer", "owner", "admin"));

router.post("/", createReview);
router.get("/user", getUserReviews);
router.put("/:reviewId", updateReview);
router.delete("/:reviewId", deleteReview);
router.post("/:reviewId/vote", voteReview);

// Owner routes
router.use(authorize("owner", "admin"));
router.post("/:reviewId/respond", respondToReview);

export default router;
