import express from "express";
import {
  createCourt,
  getAllCourts,
  getCourtById,
  updateCourt,
  deleteCourt,
  getCourtsByVenue,
  getCourtsBySport,
  checkCourtAvailability,
  getCourtPricing,
  uploadCourtImages,
  getAvailableSports,
  getCourtStats,
} from "../controllers/court.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllCourts);
router.get("/:courtId", getCourtById);
router.get("/venue/:venueId", getCourtsByVenue);
router.get("/sport/:sportType", getCourtsBySport);
router.get("/:courtId/availability", checkCourtAvailability);
router.get("/:courtId/pricing", getCourtPricing);
router.get("/sports", getAvailableSports);

// Owner routes
router.use(protect);
router.use(authorize("owner", "admin"));

router.post("/", createCourt);
router.put("/:courtId", updateCourt);
router.delete("/:courtId", deleteCourt);
router.post("/:courtId/images", uploadCourtImages);
router.get("/:courtId/stats", getCourtStats);

export default router;
