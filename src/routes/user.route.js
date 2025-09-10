import express from "express";
import {
  updateProfile,
  uploadAvatar,
  addFavoriteVenue,
  removeFavoriteVenue,
  getUserStats,
  useReferralCode,
  claimBirthdayVoucher,
  blockUser,
  unblockUser,
  addFriend,
  removeFriend,
  getFriends,
} from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

router.put("/profile", updateProfile);
router.post("/avatar", uploadAvatar);
router.post("/favorite-venues/:venueId", addFavoriteVenue);
router.delete("/favorite-venues/:venueId", removeFavoriteVenue);
router.get("/stats", getUserStats);
router.post("/use-referral/:referralCode", useReferralCode);
router.post("/birthday-voucher", claimBirthdayVoucher);
router.post("/block/:userId", blockUser);
router.delete("/block/:userId", unblockUser);
router.post("/friends/:userId", addFriend);
router.delete("/friends/:userId", removeFriend);
router.get("/friends", getFriends);

export default router;
