import express from "express";
import {
  createCoachProfile,
  getAllCoaches,
  getCoachById,
  updateCoachProfile,
  getCoachSessions,
  getCoachEarnings,
  searchCoaches,
  uploadCertifications,
  getCoachDashboard,
} from "../controllers/coach.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllCoaches);
router.get("/:coachId", getCoachById);
router.get("/search", searchCoaches);

// Coach routes
router.use(protect);
router.use(authorize("coach", "admin"));

router.post("/profile", createCoachProfile);
router.put("/profile", updateCoachProfile);
router.get("/sessions", getCoachSessions);
router.get("/earnings", getCoachEarnings);
router.post("/certifications", uploadCertifications);
router.get("/dashboard", getCoachDashboard);

export default router;
