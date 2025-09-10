import express from "express";
import {
  getAllUsers,
  getUserDetails,
  banUser,
  unbanUser,
  getPendingVenues,
  approveVenue,
  rejectVenue,
  getPendingCoaches,
  verifyCoach,
  getPendingOwners,
  verifyOwner,
  getPendingReviews,
  approveReview,
  rejectReview,
  getDashboardAnalytics,
} from "../controllers/admin.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All routes require admin role
router.use(protect);
router.use(authorize("admin"));

// User management
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserDetails);
router.put("/users/:userId/ban", banUser);
router.put("/users/:userId/unban", unbanUser);

// Venue management
router.get("/venues/pending", getPendingVenues);
router.put("/venues/:venueId/approve", approveVenue);
router.put("/venues/:venueId/reject", rejectVenue);

// Coach management
router.get("/coaches/pending", getPendingCoaches);
router.put("/coaches/:coachId/verify", verifyCoach);

// Owner management
router.get("/owners/pending", getPendingOwners);
router.put("/owners/:ownerId/verify", verifyOwner);

// Review management
router.get("/reviews/pending", getPendingReviews);
router.put("/reviews/:reviewId/approve", approveReview);
router.put("/reviews/:reviewId/reject", rejectReview);

// Dashboard
router.get("/dashboard", getDashboardAnalytics);

export default router;
