import express from "express";
import {
    checkCourtAvailability,
    courtQueryValidationRules,
    createCourt,
    deleteCourt,
    getAllCourts,
    getAvailableSports,
    getCourtById,
    getCourtPricing,
    getCourtsBySport,
    getCourtsByVenue,
    getCourtStats,
    updateCourt,
    uploadCourtImages,
    validateRequest,
} from "../controllers/court.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

// Public routes
router.get("/", courtQueryValidationRules, validateRequest, getAllCourts);
router.get("/sports", getAvailableSports);
router.get("/venue/:venueId", getCourtsByVenue);
router.get("/sport/:sportType", getCourtsBySport);
router.get("/:courtId/availability", checkCourtAvailability);
router.get("/:courtId/pricing", getCourtPricing);

// Protected routes
router.post("/", (req, res, next) => {
  console.log('=== COURT ROUTE POST ===');
  console.log('Request method:', req.method);
  console.log('Request path:', req.path);
  console.log('Request body:', req.body);
  console.log('Request user:', req.user);
  next();
}, protect, requireRoles("owner", "admin"), createCourt);

router.put("/:courtId", protect, requireRoles("owner", "admin"), updateCourt);
router.delete("/:courtId", protect, requireRoles("owner", "admin"), deleteCourt);
router.post("/:courtId/images", protect, requireRoles("owner", "admin"), uploadCourtImages);
router.get("/:courtId/stats", protect, requireRoles("owner", "admin"), getCourtStats);

// Public route for getting court by ID (must be last to avoid conflicts)
router.get("/:courtId", getCourtById);

export default router;
