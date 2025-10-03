import express from "express";
import { payosWebhook } from "../controllers/payment.controller.js";

const router = express.Router();

// PayOS webhook endpoint
router.post("/payos", payosWebhook);

// Test endpoint để kiểm tra webhook hoạt động
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Webhook endpoint is working",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  });
});

export default router;
