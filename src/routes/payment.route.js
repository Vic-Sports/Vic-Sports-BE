import express from "express";
import {
  getPaymentTransaction,
  verifyPayOSPayment,
  payosWebhook,
  getPaymentStatus,
  createPayOSPayment,
  cancelPayOSPayment,
  cleanupPendingBookings,
  debugBookingCancellation,
  fixInconsistentBookings,
  payosReturn,
  payosCancel,
} from "../controllers/payment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Get payment transaction by payment reference
router.get("/:paymentRef", getPaymentTransaction);

// PayOS payment verification
router.post("/payos/verify", verifyPayOSPayment);

// PayOS webhook endpoint (không cần auth)
router.post("/payos/webhook", payosWebhook);

// PayOS return/cancel endpoints (public)
router.get("/payos/return", payosReturn);
router.get("/payos/cancel", payosCancel);

// Create PayOS payment link (cần auth)
router.post("/payos/create", protect, createPayOSPayment);

// Cancel PayOS payment (public - không cần auth)
router.post("/payos/:orderCode/cancel", cancelPayOSPayment);

// Cleanup stuck pending bookings (cần auth)
router.post("/cleanup-pending", protect, cleanupPendingBookings);

// Debug and fix endpoints (admin only)
router.get("/debug-bookings", protect, debugBookingCancellation);
router.post("/fix-bookings", protect, fixInconsistentBookings);

// Get payment status by order code
router.get("/payos/status/:orderCode", getPaymentStatus);

export default router;
