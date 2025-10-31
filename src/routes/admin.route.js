import express from "express";
import {
  // Dashboard & Statistics
  getAdminStats,
  getDashboardAnalytics,

  // User Management
  getAllUsers,
  getUserDetails,
  updateUserByAdmin,
  banUser,
  unbanUser,

  // Venue Management
  getPendingVenues,
  approveVenue,
  rejectVenue,

  // Booking Management
  getAllBookings,
  updateBookingStatus,

  // Review Management
  getAllReviews,
  getPendingReviews,
  approveReview,
  rejectReview,
  deleteReview,

  // Coach & Owner Verification
  getPendingCoaches,
  verifyCoach,
  getPendingOwners,
  verifyOwner,

  // Financial Reports & Analytics
  getAdminRevenueData,
  getAdminUserGrowthData,
  getBookingTrends,
  getTopVenues,
} from "../controllers/admin.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize("admin"));

// ==================== DASHBOARD & STATISTICS ====================
router.get("/stats", getAdminStats);
router.get("/analytics", getDashboardAnalytics);

// ==================== USER MANAGEMENT ====================
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserDetails);
router.put("/users/:userId", updateUserByAdmin);
router.put("/users/:userId/ban", banUser);
router.put("/users/:userId/unban", unbanUser);

// ==================== VENUE MANAGEMENT ====================
router.get("/venues", getPendingVenues);
router.get("/venues/pending", getPendingVenues);
router.put("/venues/:venueId/approve", approveVenue);
router.put("/venues/:venueId/reject", rejectVenue);

// ==================== BOOKING MANAGEMENT ====================
router.get("/bookings", getAllBookings);
router.put("/bookings/:bookingId/status", updateBookingStatus);

// ==================== REVIEW MANAGEMENT ====================
router.get("/reviews", getAllReviews);
router.get("/reviews/pending", getPendingReviews);
router.put("/reviews/:reviewId/approve", approveReview);
router.put("/reviews/:reviewId/reject", rejectReview);
router.delete("/reviews/:reviewId", deleteReview);

// ==================== COACH & OWNER VERIFICATION ====================
router.get("/coaches/pending", getPendingCoaches);
router.put("/coaches/:coachId/verify", verifyCoach);
router.get("/owners/pending", getPendingOwners);
router.put("/owners/:ownerId/verify", verifyOwner);

// ==================== FINANCIAL REPORTS & ANALYTICS ====================
router.get("/revenue", getAdminRevenueData);
router.get("/user-growth", getAdminUserGrowthData);
router.get("/booking-trends", getBookingTrends);
router.get("/top-venues", getTopVenues);

export default router;


