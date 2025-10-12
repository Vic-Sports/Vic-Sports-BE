import express from "express";
import {
    getOwnerBookingInsights,
    getOwnerCustomerBehavior,
    getOwnerPopularCourts,
    // Analytics
    getOwnerRevenueAnalytics,
} from "../controllers/analytics.controller.js";
import {
    approveOwnerBooking,
    checkinOwnerBooking,
    getOwnerBookingDetail,
    // Booking
    getOwnerBookings,
    rejectOwnerBooking,
} from "../controllers/booking.controller.js";
import {
    createOwnerCourt,
    deleteOwnerCourt,
    getOwnerCourtDetail,
    // Court
    getOwnerCourts,
    updateCourtAvailability,
    updateCourtPricing,
    updateOwnerCourt,
    uploadOwnerCourtImages,
} from "../controllers/court.controller.js";
import {
    getBookingStats,
    // Dashboard
    getDashboardStats,
    getRecentActivities,
    getRevenueChart,
} from "../controllers/dashboard.controller.js";
import {
    approveOwnerTournamentRegistration,
    cancelOwnerTournament,
    createOwnerTournament,
    deleteOwnerTournament,
    getOwnerTournament,
    getOwnerTournamentMatches,
    getOwnerTournamentParticipants,
    getOwnerTournamentRegistration,
    // Tournament Registration Management
    getOwnerTournamentRegistrations,
    // Tournament Management
    getOwnerTournaments,
    getOwnerTournamentStats,
    rejectOwnerTournamentRegistration,
    startOwnerTournament,
    updateOwnerMatchResult,
    updateOwnerTournament,
    updateOwnerTournamentStatusesAPI,
    updateSingleTournamentStatusAPI,
    uploadOwnerTournamentImages,
    withdrawOwnerTournamentRegistration
} from "../controllers/tournament.controller.js";
import {
    createOwnerVenue,
    deleteOwnerVenue,
    getOwnerVenueDetail,
    // Venue
    getOwnerVenues,
    updateOwnerVenue,
    uploadOwnerVenueImages,
} from "../controllers/venue.controller.js";
import { authorize, protect } from "../middlewares/auth.middleware.js";

const router = express.Router();


// Owner authentication & authorization
router.use(protect);
router.use(authorize("owner"));

// Dashboard Overview APIs
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/revenue-chart", getRevenueChart);
router.get("/dashboard/booking-stats", getBookingStats);
router.get("/dashboard/recent-activities", getRecentActivities);

// Venue Management APIs
router.get("/venues", getOwnerVenues);
router.get("/venues/:venueId", getOwnerVenueDetail);
router.post("/venues", createOwnerVenue);
router.put("/venues/:venueId", updateOwnerVenue);
router.delete("/venues/:venueId", deleteOwnerVenue);
router.post("/venues/:venueId/upload-images", uploadOwnerVenueImages);

// Court Management APIs
router.get("/courts", getOwnerCourts);
router.get("/courts/:courtId", getOwnerCourtDetail);
router.post("/courts", createOwnerCourt);
router.put("/courts/:courtId", updateOwnerCourt);
router.delete("/courts/:courtId", deleteOwnerCourt);
router.post("/courts/:courtId/upload-images", uploadOwnerCourtImages);
router.put("/courts/:courtId/pricing", updateCourtPricing);
router.put("/courts/:courtId/availability", updateCourtAvailability);

// Booking Management APIs
router.get("/bookings", getOwnerBookings);
router.get("/bookings/:bookingId", getOwnerBookingDetail);
router.put("/bookings/:bookingId/approve", approveOwnerBooking);
router.put("/bookings/:bookingId/reject", rejectOwnerBooking);
router.put("/bookings/:bookingId/checkin", checkinOwnerBooking);

// Analytics APIs
router.get("/analytics/revenue", getOwnerRevenueAnalytics);
router.get("/analytics/booking-insights", getOwnerBookingInsights);
router.get("/analytics/popular-courts", getOwnerPopularCourts);
router.get("/analytics/customer-behavior", getOwnerCustomerBehavior);

// Tournament Management APIs
router.get("/tournaments", getOwnerTournaments);
router.get("/tournaments/stats", getOwnerTournamentStats);
router.get("/tournaments/:id", getOwnerTournament);
router.post("/tournaments", createOwnerTournament);
router.put("/tournaments/:id", updateOwnerTournament);
router.delete("/tournaments/:id", deleteOwnerTournament);
router.put("/tournaments/:id/start", startOwnerTournament);
router.put("/tournaments/:id/cancel", cancelOwnerTournament);
router.get("/tournaments/:id/participants", getOwnerTournamentParticipants);
router.get("/tournaments/:id/matches", getOwnerTournamentMatches);
router.put("/tournaments/:id/matches/:matchId", updateOwnerMatchResult);
router.post("/tournaments/:id/upload-images", uploadOwnerTournamentImages);

// Tournament Status Update APIs
router.post("/tournaments/update-statuses", updateOwnerTournamentStatusesAPI);
router.post("/tournaments/:id/update-status", updateSingleTournamentStatusAPI);

// Tournament Registration Management APIs
router.get("/tournaments/:id/registrations", getOwnerTournamentRegistrations);
router.get("/tournaments/:id/registrations/:registrationId", getOwnerTournamentRegistration);
router.put("/tournaments/:id/registrations/:registrationId/approve", approveOwnerTournamentRegistration);
router.put("/tournaments/:id/registrations/:registrationId/reject", rejectOwnerTournamentRegistration);
router.put("/tournaments/:id/registrations/:registrationId/withdraw", withdrawOwnerTournamentRegistration);


export default router;
