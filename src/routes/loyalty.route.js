import express from "express";
import {
  getLoyaltyInfo,
  getPointsHistory,
  usePointsForDiscount,
  getTierBenefits,
  getReferralStats,
  getReferralLink,
} from "../controllers/loyalty.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);
router.use(authorize("customer", "admin"));

router.get("/info", getLoyaltyInfo);
router.get("/points-history", getPointsHistory);
router.post("/use-points", usePointsForDiscount);
router.get("/tier-benefits", getTierBenefits);
router.get("/referral-stats", getReferralStats);
router.get("/referral-link", getReferralLink);

export default router;
