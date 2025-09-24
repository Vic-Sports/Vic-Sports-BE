import express from "express";
import { getPaymentTransaction } from "../controllers/payment.controller.js";

const router = express.Router();

// Get payment transaction by payment reference
router.get("/:paymentRef", getPaymentTransaction);

export default router;
