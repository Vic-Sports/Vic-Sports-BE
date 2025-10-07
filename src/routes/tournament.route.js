import express from "express";
import {
    createTestTournament,
    createTournament,
    deleteTournament,
    getAllTournaments,
    getAllTournamentsForDebug,
    getAllTournamentsList,
    getFeaturedTournaments,
    getLatestActiveTournaments,
    getTournamentById,
    getTournamentParticipants,
    getTournamentStats,
    joinTournament,
    updateTournament,
} from "../controllers/tournament.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { restrictTo } from "../middlewares/role.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllTournaments);
router.get("/list-all", getAllTournamentsList);
router.get("/featured", getFeaturedTournaments);
router.get("/latest-active", getLatestActiveTournaments);
router.get("/debug-all", getAllTournamentsForDebug);
router.post("/create-test", createTestTournament);
router.get("/stats", getTournamentStats);
router.get("/:id", getTournamentById);
router.get("/:id/participants", getTournamentParticipants);

// Protected routes
router.use(protect);

// User routes
router.post("/:id/join", joinTournament);

// Admin/Owner routes
router.post("/", restrictTo("admin", "owner"), createTournament);
router.put("/:id", restrictTo("admin", "owner"), updateTournament);
router.delete("/:id", restrictTo("admin", "owner"), deleteTournament);

export default router;
