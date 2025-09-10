import User from "../models/user.js";
import Venue from "../models/venue.js";
import Court from "../models/court.js";
import Booking from "../models/booking.js";
import Review from "../models/review.js";
import Coach from "../models/coach.js";
import Owner from "../models/owner.js";
import mongoose from "mongoose";

// @desc    Get Revenue Reports
// @route   GET /api/analytics/revenue
// @access Private (Admin/Owner)
export const getRevenueReports = async (req, res) => {
  try {
    const { period = "30d", venueId } = req.query;
    const userId = req.user.id;

    let startDate;
    switch (period) {
      case "7d":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const query = {
      status: "completed",
      createdAt: { $gte: startDate },
    };

    // If venueId provided, filter by venue (for venue owners)
    if (venueId) {
      // Check if user is venue owner
      const venue = await Venue.findById(venueId);
      if (!venue || !venue.ownerId.equals(userId)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this venue's revenue",
        });
      }
      query.venueId = venueId;
    }

    const revenueData = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          totalRevenue: { $sum: "$finalPrice" },
          totalBookings: { $sum: 1 },
          averageBookingValue: { $avg: "$finalPrice" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    const totalRevenue = revenueData.reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalBookings = revenueData.reduce((sum, item) => sum + item.totalBookings, 0);

    res.status(200).json({
      success: true,
      data: {
        revenueData,
        summary: {
          totalRevenue,
          totalBookings,
          averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
          period,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Booking Analytics
// @route   GET /api/analytics/bookings
// @access Private (Admin/Owner)
export const getBookingAnalytics = async (req, res) => {
  try {
    const { period = "30d", venueId } = req.query;
    const userId = req.user.id;

    let startDate;
    switch (period) {
      case "7d":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const query = {
      createdAt: { $gte: startDate },
    };

    if (venueId) {
      const venue = await Venue.findById(venueId);
      if (!venue || !venue.ownerId.equals(userId)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this venue's analytics",
        });
      }
      query.venueId = venueId;
    }

    // Booking status distribution
    const statusDistribution = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Popular time slots
    const popularTimeSlots = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$timeSlot.start",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Popular sports
    const popularSports = await Booking.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "courts",
          localField: "courtId",
          foreignField: "_id",
          as: "court",
        },
      },
      { $unwind: "$court" },
      {
        $group: {
          _id: "$court.sportType",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        analytics: {
          statusDistribution,
          popularTimeSlots,
          popularSports,
          period,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get User Statistics
// @route   GET /api/analytics/users
// @access Private (Admin)
export const getUserStatistics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    let startDate;
    switch (period) {
      case "7d":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // User registration trends
    const registrationTrends = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // User role distribution
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // Loyalty tier distribution
    const loyaltyTierDistribution = await User.aggregate([
      {
        $group: {
          _id: "$loyaltyTier",
          count: { $sum: 1 },
        },
      },
    ]);

    // Active users (users with bookings)
    const activeUsers = await User.countDocuments({
      totalBookings: { $gt: 0 },
    });

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          registrationTrends,
          roleDistribution,
          loyaltyTierDistribution,
          activeUsers,
          totalUsers: await User.countDocuments(),
          period,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Venue Performance
// @route   GET /api/analytics/venues
// @access Private (Admin/Owner)
export const getVenuePerformance = async (req, res) => {
  try {
    const { period = "30d", venueId } = req.query;
    const userId = req.user.id;

    let startDate;
    switch (period) {
      case "7d":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const query = {
      createdAt: { $gte: startDate },
    };

    if (venueId) {
      const venue = await Venue.findById(venueId);
      if (!venue || !venue.ownerId.equals(userId)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this venue's performance",
        });
      }
      query.venueId = venueId;
    }

    // Top performing venues
    const topVenues = await Booking.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "venues",
          localField: "venueId",
          foreignField: "_id",
          as: "venue",
        },
      },
      { $unwind: "$venue" },
      {
        $group: {
          _id: "$venueId",
          venueName: { $first: "$venue.name" },
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: "$finalPrice" },
          averageRating: { $avg: "$venue.ratings.average" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ]);

    // Venue utilization by city
    const venueUtilizationByCity = await Booking.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "venues",
          localField: "venueId",
          foreignField: "_id",
          as: "venue",
        },
      },
      { $unwind: "$venue" },
      {
        $group: {
          _id: "$venue.address.city",
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: "$finalPrice" },
          venueCount: { $addToSet: "$venueId" },
        },
      },
      {
        $project: {
          city: "$_id",
          totalBookings: 1,
          totalRevenue: 1,
          venueCount: { $size: "$venueCount" },
        },
      },
      { $sort: { totalBookings: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        performance: {
          topVenues,
          venueUtilizationByCity,
          period,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Popular Time Slots
// @route   GET /api/analytics/popular-times
// @access Public
export const getPopularTimeSlots = async (req, res) => {
  try {
    const { period = "30d", sportType, city } = req.query;

    let startDate;
    switch (period) {
      case "7d":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const query = {
      status: "completed",
      createdAt: { $gte: startDate },
    };

    // Filter by sport type if provided
    if (sportType) {
      const courts = await Court.find({ sportType }).select("_id");
      const courtIds = courts.map(court => court._id);
      query.courtId = { $in: courtIds };
    }

    // Filter by city if provided
    if (city) {
      const venues = await Venue.find({ "address.city": city }).select("_id");
      const venueIds = venues.map(venue => venue._id);
      query.venueId = { $in: venueIds };
    }

    // Popular time slots by hour
    const popularTimeSlots = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$timeSlot.start",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$finalPrice" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // Popular days of week
    const popularDays = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dayOfWeek: "$bookingDate" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        popularTimes: {
          timeSlots: popularTimeSlots,
          daysOfWeek: popularDays,
          period,
          filters: { sportType, city },
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Dashboard Overview
// @route   GET /api/analytics/dashboard
// @access Private (Admin)
export const getDashboardOverview = async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    let startDate;
    switch (period) {
      case "7d":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get overview statistics
    const [
      totalUsers,
      totalVenues,
      totalBookings,
      totalRevenue,
      newUsers,
      newVenues,
      pendingApprovals,
    ] = await Promise.all([
      User.countDocuments(),
      Venue.countDocuments({ isActive: true }),
      Booking.countDocuments({ status: "completed" }),
      Booking.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$finalPrice" } } },
      ]),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      Venue.countDocuments({ createdAt: { $gte: startDate } }),
      Venue.countDocuments({ isVerified: false }) + 
      Coach.countDocuments({ isVerified: false }) +
      Owner.countDocuments({ isVerified: false }),
    ]);

    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalVenues,
          totalBookings,
          totalRevenue: revenue,
          newUsers,
          newVenues,
          pendingApprovals,
          period,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
