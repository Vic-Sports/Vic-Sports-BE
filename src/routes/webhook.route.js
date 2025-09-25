import express from "express";
import { payosWebhook } from "../controllers/payment.controller.js";

const router = express.Router();

// PayOS webhook endpoint
router.post("/payos", payosWebhook);

export default router;
