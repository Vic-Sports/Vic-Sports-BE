import Booking from "../models/booking.js";
import Venue from "../models/venue.js";
import Court from "../models/court.js";

// GET /api/owner/dashboard/stats
export const getDashboardStats = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Get owner's venues
    const ownerVenues = await Venue.find({ ownerId, isActive: true }).select(
      "_id"
    );
    const venueIds = ownerVenues.map((venue) => venue._id);

    if (venueIds.length === 0) {
      return res.json({
        success: true,
        data: {
          totalVenues: 0,
          totalCourts: 0,
          totalBookings: 0,
          pendingBookings: 0,
          confirmedBookings: 0,
          completedBookings: 0,
          totalRevenue: 0,
        },
      });
    }

    // Get stats
    const totalVenues = venueIds.length;
    const totalCourts = await Court.countDocuments({
      venueId: { $in: venueIds },
      isActive: true,
    });

    const totalBookings = await Booking.countDocuments({
      venue: { $in: venueIds },
    });

    const pendingBookings = await Booking.countDocuments({
      venue: { $in: venueIds },
      status: "pending",
    });

    const confirmedBookings = await Booking.countDocuments({
      venue: { $in: venueIds },
      status: "confirmed",
    });

    const completedBookings = await Booking.countDocuments({
      venue: { $in: venueIds },
      status: "completed",
    });

    const totalRevenue = await Booking.aggregate([
      {
        $match: {
          venue: { $in: venueIds },
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalPrice" },
        },
      },
    ]);

    console.log("Dashboard stats:", {
      totalVenues,
      totalCourts,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      totalRevenue: totalRevenue[0]?.revenue || 0,
    });

    return res.json({
      success: true,
      data: {
        totalVenues,
        totalCourts,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        totalRevenue: totalRevenue[0]?.revenue || 0,
      },
    });
  } catch (error) {
    console.log("Dashboard stats error:", error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: error.message },
    });
  }
};

// GET /api/owner/dashboard/revenue-chart
export const getRevenueChart = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { months = 12 } = req.query; // Default 12 months

    console.log("=== REVENUE CHART DEBUG ===");
    console.log("Owner ID:", ownerId);
    console.log("Months requested:", months);

    // Get owner's venues
    const ownerVenues = await Venue.find({ ownerId, isActive: true }).select(
      "_id"
    );
    const venueIds = ownerVenues.map((venue) => venue._id);

    console.log("Owner venues:", venueIds.length);

    if (venueIds.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Calculate date range (last N months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    console.log("Date range:", startDate, "to", endDate);

    // Group by month and year - match FE requirements exactly
    const chart = await Booking.aggregate([
      {
        $match: {
          venue: { $in: venueIds },
          status: "completed",
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          revenue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    console.log("Revenue chart data:", chart);

    return res.json({
      success: true,
      data: chart,
    });
  } catch (error) {
    console.log("Revenue chart error:", error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: error.message },
    });
  }
};

// GET /api/owner/dashboard/booking-stats
export const getBookingStats = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { period = 30 } = req.query; // Default 30 days

    console.log("=== BOOKING STATS DEBUG ===");
    console.log("Owner ID:", ownerId);
    console.log("Period (days):", period);

    // Get owner's venues
    const ownerVenues = await Venue.find({ ownerId, isActive: true }).select(
      "_id"
    );
    const venueIds = ownerVenues.map((venue) => venue._id);

    console.log("Owner venues:", venueIds.length);

    if (venueIds.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Calculate date range for recent bookings
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    console.log("Date range: last", period, "days from", startDate);

    // Group by status and sportType - match FE requirements exactly
    const stats = await Booking.aggregate([
      {
        $match: {
          venue: { $in: venueIds },
          createdAt: { $gte: startDate },
        },
      },
      {
        $lookup: {
          from: "courts",
          localField: "court",
          foreignField: "_id",
          as: "courtInfo",
        },
      },
      {
        $unwind: {
          path: "$courtInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            status: "$status",
            sportType: "$courtInfo.sportType",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.status": 1, "_id.sportType": 1 } },
    ]);

    console.log("Booking stats data:", stats);

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.log("Booking stats error:", error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: error.message },
    });
  }
};

// GET /api/owner/dashboard/recent-activities
export const getRecentActivities = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { limit = 10 } = req.query;

    console.log("=== RECENT ACTIVITIES DEBUG ===");
    console.log("Owner ID:", ownerId);
    console.log("Limit:", limit);

    // Get owner's venues
    const ownerVenues = await Venue.find({ ownerId, isActive: true }).select(
      "_id"
    );
    const venueIds = ownerVenues.map((venue) => venue._id);

    console.log("Owner venues:", venueIds.length);

    if (venueIds.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Get recent bookings with full details
    const activities = await Booking.find({
      venue: { $in: venueIds },
    })
      .populate({
        path: "user",
        select: "fullName email phone",
      })
      .populate({
        path: "venue",
        select: "name",
      })
      .populate({
        path: "court",
        select: "name sportType",
      })
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit));

    console.log("Recent activities found:", activities.length);

    return res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.log("Recent activities error:", error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: error.message },
    });
  }
};
