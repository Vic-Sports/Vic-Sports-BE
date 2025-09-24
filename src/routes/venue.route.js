/**
 * @fileoverview Venue Routes
 * @created 2025-01-15
 * @file venue.route.js
 * @description This file defines all venue-related routes for the Vic Sports application.
 * It maps HTTP endpoints to their corresponding controller functions and applies necessary middleware.
 */

import express from "express";
import {
    createVenue,
    deleteVenue,
    getAllVenues,
    getAvailableCities,
    getDistrictsByCity,
    getVenueById,
    getVenuesByOwner,
    getVenueStats,
    removeVenueImage,
    searchVenuesByLocation,
    updateVenue,
    uploadVenueImages,
    validateRequest,
    venueQueryValidationRules,
} from "../controllers/venue.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

// Public routes
router.get("/", venueQueryValidationRules, validateRequest, getAllVenues);
router.get("/search/location", searchVenuesByLocation);
router.get("/cities", getAvailableCities);
router.get("/districts/:city", getDistrictsByCity);

// Protected routes
router.use(protect);

// Owner routes
router.post("/", (req, res, next) => {
  console.log('=== VENUE ROUTE POST ===');
  console.log('Request method:', req.method);
  console.log('Request path:', req.path);
  console.log('Request body:', req.body);
  console.log('Request user:', req.user);
  next();
}, requireRoles("customer", "owner"), createVenue);
router.put("/:venueId", requireRoles("owner"), updateVenue);
router.delete("/:venueId", requireRoles("owner"), deleteVenue);
router.post("/:venueId/images", requireRoles("owner"), uploadVenueImages);
router.delete("/:venueId/images/:imageIndex", requireRoles("owner"), removeVenueImage);
router.get("/:venueId/stats", requireRoles("owner"), getVenueStats);
router.get("/owner/:ownerId", requireRoles("owner", "admin"), getVenuesByOwner);

// Public route for getting venue by ID (must be last to avoid conflicts)
router.get("/:venueId", getVenueById);

export default router;
