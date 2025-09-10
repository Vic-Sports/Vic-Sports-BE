import express from "express";
import {
  getRevenueReports,
  getBookingAnalytics,
  getUserStatistics,
  getVenuePerformance,
  getPopularTimeSlots,
  getDashboardOverview,
} from "../controllers/analytics.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public analytics
router.get("/popular-times", getPopularTimeSlots);

// Admin/Owner analytics
router.use(protect);
router.use(authorize("admin", "owner"));

router.get("/revenue", getRevenueReports);
router.get("/bookings", getBookingAnalytics);
router.get("/venues", getVenuePerformance);

// Admin only analytics
router.use(authorize("admin"));
router.get("/users", getUserStatistics);
router.get("/dashboard", getDashboardOverview);

export default router;
