import express from "express";
import {
  createVenue,
  getAllVenues,
  getVenueById,
  updateVenue,
  deleteVenue,
  uploadVenueImages,
  removeVenueImage,
  getVenueStats,
  searchVenuesByLocation,
  getVenuesByOwner,
  getAvailableCities,
  getDistrictsByCity,
  searchVenues,
} from "../controllers/venue.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllVenues);
router.post("/search", searchVenues);
router.get("/:venueId", getVenueById);
router.get("/search/location", searchVenuesByLocation);
router.get("/cities", getAvailableCities);
router.get("/districts/:city", getDistrictsByCity);

// Owner routes
router.use(protect);
router.use(authorize("owner", "admin"));

router.post("/", createVenue);
router.put("/:venueId", updateVenue);
router.delete("/:venueId", deleteVenue);
router.post("/:venueId/images", uploadVenueImages);
router.delete("/:venueId/images/:imageIndex", removeVenueImage);
router.get("/:venueId/stats", getVenueStats);
router.get("/owner/:ownerId", getVenuesByOwner);

export default router;
