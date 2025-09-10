import express from "express";
import {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  rescheduleBooking,
  checkInBooking,
  checkOutBooking,
  searchAvailableCourts,
} from "../controllers/booking.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public booking search
router.get("/search", searchAvailableCourts);

// Protected routes
router.use(protect);
router.use(authorize("customer", "owner", "admin"));

router.post("/", createBooking);
router.get("/", getUserBookings);
router.get("/:bookingId", getBookingById);
router.put("/:bookingId/cancel", cancelBooking);
router.put("/:bookingId/reschedule", rescheduleBooking);
router.put("/:bookingId/checkin", checkInBooking);
router.put("/:bookingId/checkout", checkOutBooking);

export default router;
