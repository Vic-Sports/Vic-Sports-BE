import express from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import {
  // Dashboard
  getDashboardStats,
  getRevenueChart,
  getBookingStats,
  getRecentActivities,
} from "../controllers/dashboard.controller.js";
import {
  // Venue
  getOwnerVenues,
  getOwnerVenueDetail,
  createOwnerVenue,
  updateOwnerVenue,
  deleteOwnerVenue,
  uploadOwnerVenueImages,
} from "../controllers/venue.controller.js";
import {
  // Court
  getOwnerCourts,
  getOwnerCourtDetail,
  createOwnerCourt,
  updateOwnerCourt,
  deleteOwnerCourt,
  uploadOwnerCourtImages,
  updateCourtPricing,
  updateCourtAvailability,
} from "../controllers/court.controller.js";
import {
  // Booking
  getOwnerBookings,
  getOwnerBookingDetail,
  approveOwnerBooking,
  rejectOwnerBooking,
  checkinOwnerBooking,
} from "../controllers/booking.controller.js";
import {
  // Analytics
  getOwnerRevenueAnalytics,
  getOwnerBookingInsights,
  getOwnerPopularCourts,
  getOwnerCustomerBehavior,
} from "../controllers/analytics.controller.js";

const router = express.Router();

// Owner authentication & authorization
router.use(protect);
router.use(authorize("owner"));

// Dashboard Overview APIs
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/revenue-chart", getRevenueChart);
router.get("/dashboard/booking-stats", getBookingStats);
router.get("/dashboard/recent-activities", getRecentActivities);

// Venue Management APIs
router.get("/venues", getOwnerVenues);
router.get("/venues/:venueId", getOwnerVenueDetail);
router.post("/venues", createOwnerVenue);
router.put("/venues/:venueId", updateOwnerVenue);
router.delete("/venues/:venueId", deleteOwnerVenue);
router.post("/venues/:venueId/upload-images", uploadOwnerVenueImages);

// Court Management APIs
router.get("/courts", getOwnerCourts);
router.get("/courts/:courtId", getOwnerCourtDetail);
router.post("/courts", createOwnerCourt);
router.put("/courts/:courtId", updateOwnerCourt);
router.delete("/courts/:courtId", deleteOwnerCourt);
router.post("/courts/:courtId/upload-images", uploadOwnerCourtImages);
router.put("/courts/:courtId/pricing", updateCourtPricing);
router.put("/courts/:courtId/availability", updateCourtAvailability);

// Booking Management APIs
router.get("/bookings", getOwnerBookings);
router.get("/bookings/:bookingId", getOwnerBookingDetail);
router.put("/bookings/:bookingId/approve", approveOwnerBooking);
router.put("/bookings/:bookingId/reject", rejectOwnerBooking);
router.put("/bookings/:bookingId/checkin", checkinOwnerBooking);

// Analytics APIs
router.get("/analytics/revenue", getOwnerRevenueAnalytics);
router.get("/analytics/booking-insights", getOwnerBookingInsights);
router.get("/analytics/popular-courts", getOwnerPopularCourts);
router.get("/analytics/customer-behavior", getOwnerCustomerBehavior);

export default router;
