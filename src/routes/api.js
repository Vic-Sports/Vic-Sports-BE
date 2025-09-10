import express from "express";
import authRoutes from "./auth.route.js";
import userRoutes from "./user.route.js";
import adminRoutes from "./admin.route.js";
import venueRoutes from "./venue.route.js";
import courtRoutes from "./court.route.js";
import bookingRoutes from "./booking.route.js";
import reviewRoutes from "./review.route.js";
import chatRoutes from "./chat.route.js";
import coachRoutes from "./coach.route.js";
import loyaltyRoutes from "./loyalty.route.js";
import analyticsRoutes from "./analytics.route.js";

const router = express.Router();

// Mount all routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/venues", venueRoutes);
router.use("/courts", courtRoutes);
router.use("/bookings", bookingRoutes);
router.use("/reviews", reviewRoutes);
router.use("/chats", chatRoutes);
router.use("/coaches", coachRoutes);
router.use("/loyalty", loyaltyRoutes);
router.use("/analytics", analyticsRoutes);

export default router;