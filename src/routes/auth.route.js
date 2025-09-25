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
router.get("/account", getMe); // Alias for /me endpoint
router.put("/change-password", changePassword);
router.post("/logout", logout);
router.post("/logout-all", logoutAll);

export default router;
