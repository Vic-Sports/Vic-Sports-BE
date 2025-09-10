import express from "express";
import {
  register,
  login,
  socialLogin,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
  logoutAll,
  refreshToken,
  getMe,
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/social-login", socialLogin);
router.get("/verify-email/:token", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
router.post("/refresh-token", refreshToken);

// Protected routes
router.use(protect);
router.get("/me", getMe);
router.put("/change-password", changePassword);
router.post("/logout", logout);
router.post("/logout-all", logoutAll);

export default router;
