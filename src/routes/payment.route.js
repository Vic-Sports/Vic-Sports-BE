import express from "express";
import {
  getPaymentTransaction,
  verifyPayOSPayment,
  payosWebhook,
  getPaymentStatus,
  createPayOSPayment,
  cancelPayOSPayment,
} from "../controllers/payment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Get payment transaction by payment reference
router.get("/:paymentRef", getPaymentTransaction);

// PayOS payment verification
router.post("/payos/verify", verifyPayOSPayment);

// PayOS webhook endpoint (không cần auth)
router.post("/payos/webhook", payosWebhook);

// Create PayOS payment link (cần auth)
router.post("/payos/create", protect, createPayOSPayment);

// Cancel PayOS payment (cần auth)
router.post("/payos/:orderCode/cancel", protect, cancelPayOSPayment);

// Get payment status by order code
router.get("/payos/status/:orderCode", getPaymentStatus);

export default router;
