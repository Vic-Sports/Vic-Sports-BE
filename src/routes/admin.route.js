import express from "express";
import {
  getAllUsers,
  getUserDetails,
  updateUserByAdmin,
  getPendingVenues,
  approveVenue,
  rejectVenue,
  promoteUserToOwner,
  confirmGoogleGroup,
} from "../controllers/admin.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Admin protected routes
router.use(protect);
router.use(authorize("admin"));

// Users management
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserDetails);
router.put("/users/:userId", updateUserByAdmin);
router.put("/users/:userId/promote", promoteUserToOwner);
router.put("/users/:userId/confirm-google-group", confirmGoogleGroup);

// Venues management
router.get("/venues/pending", getPendingVenues);
router.put("/venues/:venueId/approve", approveVenue);
router.put("/venues/:venueId/reject", rejectVenue);

export default router;
