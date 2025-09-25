import express from "express";
import {
  createCourt,
  getAllCourts,
  getCourtById,
  updateCourt,
  deleteCourt,
  getCourtsByVenue,
  getCourtsBySport,
  getCourtAvailability,
  getCourtPricing,
  uploadCourtImages,
  getAvailableSports,
  getCourtStats,
} from "../controllers/court.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllCourts); // done
router.get("/sports", getAvailableSports); // Move before /:courtId to avoid conflicts
router.get("/:courtId", getCourtById); // done
router.get("/venue/:venueId", getCourtsByVenue); // done
router.get("/sport/:sportType", getCourtsBySport); // Updated to support venueId query param
router.get("/:courtId/availability", getCourtAvailability); // Updated availability check
router.get("/:courtId/pricing", getCourtPricing); // done

// Owner routes
router.use(protect);
router.use(authorize("owner", "admin"));

router.post("/", createCourt);
router.put("/:courtId", updateCourt);
router.delete("/:courtId", deleteCourt);
router.post("/:courtId/images", uploadCourtImages);
router.get("/:courtId/stats", getCourtStats);

export default router;
