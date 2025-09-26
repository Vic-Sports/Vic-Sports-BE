// ...existing code...
import express from "express";
import {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  searchAvailableCourts,
  createSimpleBooking,
  testBookingCreation,
  getBookingsByUserId,
} from "../controllers/booking.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Optional auth middleware for guest bookings
const optionalAuth = (req, res, next) => {
  try {
    // Try to authenticate, but don't require it
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      // If token exists, try to verify it
      protect(req, res, next);
    } else {
      // No token, continue as guest
      next();
    }
  } catch (error) {
    // Authentication failed, continue as guest
    next();
  }
};

// Public routes
router.get("/search", searchAvailableCourts);
router.post("/test", testBookingCreation); // Test booking for debugging
router.post("/simple", createSimpleBooking); // Simple booking for frontend testing
router.post("/", optionalAuth, createBooking); // Allow guest bookings

// Protected routes

// Admin route: get bookings by userId
router.get(
  "/user/:userId",
  protect,
  authorize("admin", "customer"),
  getBookingsByUserId
);

// User route: get own booking history
router.get(
  "/user/me",
  protect,
  authorize("customer", "owner", "admin"),
  getUserBookings
);

router.use(protect);
router.use(authorize("customer", "owner", "admin"));

router.get("/", getUserBookings);
router.get("/:bookingId", getBookingById);
router.put("/:bookingId/cancel", cancelBooking);

export default router;
