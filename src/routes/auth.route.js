import express from "express";
import {
  changePassword,
  forgotPassword,
  getMe,
  login,
  logout,
  logoutAll,
  refreshToken,
  register,
  resetPassword,
  socialLogin,
  verifyEmail,
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { getGoogleAuthUrl, oAuth2Client } from "../config/googleAuth.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/social-login", socialLogin);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
router.post("/refresh-token", refreshToken);

// Protected routes
router.use(protect);
router.get("/me", getMe);
router.get("/account", getMe); // Alias for /me endpoint
router.put("/change-password", changePassword);
// Logout does NOT use protect middleware
router.post("/logout", logout);
// Logout all still requires protect
router.post("/logout-all", protect, logoutAll);

export default router;
