import User from "../models/user.js";
import Venue from "../models/venue.js";
import Court from "../models/court.js";
import Booking from "../models/booking.js";
import Review from "../models/review.js";
import Coach from "../models/coach.js";
import Owner from "../models/owner.js";
import mongoose from "mongoose";
//conflict resolution
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

    const totalRevenue = revenueData.reduce(
      (sum, item) => sum + item.totalRevenue,
      0
    );
    const totalBookings = revenueData.reduce(
      (sum, item) => sum + item.totalBookings,
      0
    );

    res.status(200).json({
      success: true,
      data: {
        revenueData,
        summary: {
          totalRevenue,
          totalBookings,
          averageBookingValue:
            totalBookings > 0 ? totalRevenue / totalBookings : 0,
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
      const courtIds = courts.map((court) => court._id);
      query.courtId = { $in: courtIds };
    }

    // Filter by city if provided
    if (city) {
      const venues = await Venue.find({ "address.city": city }).select("_id");
      const venueIds = venues.map((venue) => venue._id);
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

// @desc    Get Owner Revenue Analytics
// @route   GET /api/owner/analytics/revenue
// @access Private (Owner)
export const getOwnerRevenueAnalytics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const ownerId = req.user.id;

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

    // Get owner's venues
    const ownerVenues = await Venue.find({ ownerId }).select("_id");
    const venueIds = ownerVenues.map((venue) => venue._id);

    const query = {
      status: "completed",
      createdAt: { $gte: startDate },
      venue: { $in: venueIds },
    };

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

    // Revenue by venue
    const revenueByVenue = await Booking.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "venues",
          localField: "venue",
          foreignField: "_id",
          as: "venueInfo",
        },
      },
      { $unwind: "$venueInfo" },
      {
        $group: {
          _id: "$venue",
          venueName: { $first: "$venueInfo.name" },
          totalRevenue: { $sum: "$finalPrice" },
          totalBookings: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    const totalRevenue = revenueData.reduce(
      (sum, item) => sum + item.totalRevenue,
      0
    );
    const totalBookings = revenueData.reduce(
      (sum, item) => sum + item.totalBookings,
      0
    );

    res.status(200).json({
      success: true,
      data: {
        revenueData,
        revenueByVenue,
        summary: {
          totalRevenue,
          totalBookings,
          averageBookingValue:
            totalBookings > 0 ? totalRevenue / totalBookings : 0,
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

// @desc    Get Owner Booking Insights
// @route   GET /api/owner/analytics/booking-insights
// @access Private (Owner)
export const getOwnerBookingInsights = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const ownerId = req.user.id;

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

    // Get owner's venues
    const ownerVenues = await Venue.find({ ownerId }).select("_id");
    const venueIds = ownerVenues.map((venue) => venue._id);

    const query = {
      createdAt: { $gte: startDate },
      venue: { $in: venueIds },
    };

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
        $unwind: "$timeSlots",
      },
      {
        $group: {
          _id: "$timeSlots.start",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Booking trends by day
    const bookingTrends = await Booking.aggregate([
      { $match: query },
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

    // Customer repeat booking rate
    const customerInsights = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$customer",
          bookingCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          repeatCustomers: {
            $sum: { $cond: [{ $gt: ["$bookingCount", 1] }, 1, 0] },
          },
        },
      },
    ]);

    const repeatRate =
      customerInsights.length > 0
        ? (
            (customerInsights[0].repeatCustomers /
              customerInsights[0].totalCustomers) *
            100
          ).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        insights: {
          statusDistribution,
          popularTimeSlots,
          bookingTrends,
          customerRepeatRate: parseFloat(repeatRate),
          totalCustomers:
            customerInsights.length > 0
              ? customerInsights[0].totalCustomers
              : 0,
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

// @desc    Get Owner Popular Courts
// @route   GET /api/owner/analytics/popular-courts
// @access Private (Owner)
export const getOwnerPopularCourts = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const ownerId = req.user.id;

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

    // Get owner's venues
    const ownerVenues = await Venue.find({ ownerId }).select("_id");
    const venueIds = ownerVenues.map((venue) => venue._id);

    const query = {
      createdAt: { $gte: startDate },
      venue: { $in: venueIds },
    };

    // Popular courts by bookings
    const popularCourts = await Booking.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "courts",
          localField: "court",
          foreignField: "_id",
          as: "courtInfo",
        },
      },
      { $unwind: "$courtInfo" },
      {
        $lookup: {
          from: "venues",
          localField: "venue",
          foreignField: "_id",
          as: "venueInfo",
        },
      },
      { $unwind: "$venueInfo" },
      {
        $group: {
          _id: "$court",
          courtName: { $first: "$courtInfo.name" },
          venueName: { $first: "$venueInfo.name" },
          sportType: { $first: "$courtInfo.sportType" },
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: "$finalPrice" },
          averageRating: { $avg: "$courtInfo.ratings.average" },
        },
      },
      { $sort: { totalBookings: -1 } },
      { $limit: 10 },
    ]);

    // Popular sports in owner's venues
    const popularSports = await Booking.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "courts",
          localField: "court",
          foreignField: "_id",
          as: "courtInfo",
        },
      },
      { $unwind: "$courtInfo" },
      {
        $group: {
          _id: "$courtInfo.sportType",
          count: { $sum: 1 },
          revenue: { $sum: "$finalPrice" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Court utilization rate
    const totalCourts = await Court.countDocuments({
      venueId: { $in: venueIds },
      isActive: true,
    });

    const courtsWithBookings = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$court",
        },
      },
    ]);

    const utilizationRate =
      totalCourts > 0
        ? ((courtsWithBookings.length / totalCourts) * 100).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        popularCourts,
        popularSports,
        utilizationRate: parseFloat(utilizationRate),
        totalCourts,
        activeCourts: courtsWithBookings.length,
        period,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Owner Customer Behavior
// @route   GET /api/owner/analytics/customer-behavior
// @access Private (Owner)
export const getOwnerCustomerBehavior = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const ownerId = req.user.id;

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

    // Get owner's venues
    const ownerVenues = await Venue.find({ ownerId }).select("_id");
    const venueIds = ownerVenues.map((venue) => venue._id);

    const query = {
      createdAt: { $gte: startDate },
      venue: { $in: venueIds },
    };

    // Customer booking frequency
    const customerFrequency = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$customer",
          bookingCount: { $sum: 1 },
          totalSpent: { $sum: "$finalPrice" },
          avgBookingValue: { $avg: "$finalPrice" },
        },
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          oneTimeCustomers: {
            $sum: { $cond: [{ $eq: ["$bookingCount", 1] }, 1, 0] },
          },
          repeatCustomers: {
            $sum: { $cond: [{ $gt: ["$bookingCount", 1] }, 1, 0] },
          },
          frequentCustomers: {
            $sum: { $cond: [{ $gte: ["$bookingCount", 5] }, 1, 0] },
          },
          averageSpentPerCustomer: { $avg: "$totalSpent" },
        },
      },
    ]);

    // Top customers
    const topCustomers = await Booking.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "customer",
          foreignField: "_id",
          as: "customerInfo",
        },
      },
      { $unwind: "$customerInfo" },
      {
        $group: {
          _id: "$customer",
          customerName: { $first: "$customerInfo.fullName" },
          email: { $first: "$customerInfo.email" },
          bookingCount: { $sum: 1 },
          totalSpent: { $sum: "$finalPrice" },
          lastBooking: { $max: "$createdAt" },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
    ]);

    // Booking patterns by day of week
    const dayOfWeekPatterns = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dayOfWeek: "$date" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Peak hours analysis
    const peakHours = await Booking.aggregate([
      { $match: query },
      {
        $unwind: "$timeSlots",
      },
      {
        $addFields: {
          hour: { $toInt: { $substr: ["$timeSlots.start", 0, 2] } },
        },
      },
      {
        $group: {
          _id: "$hour",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const behaviorData =
      customerFrequency.length > 0
        ? customerFrequency[0]
        : {
            totalCustomers: 0,
            oneTimeCustomers: 0,
            repeatCustomers: 0,
            frequentCustomers: 0,
            averageSpentPerCustomer: 0,
          };

    res.status(200).json({
      success: true,
      data: {
        customerBehavior: {
          ...behaviorData,
          repeatCustomerRate:
            behaviorData.totalCustomers > 0
              ? (
                  (behaviorData.repeatCustomers / behaviorData.totalCustomers) *
                  100
                ).toFixed(2)
              : 0,
          topCustomers,
          dayOfWeekPatterns,
          peakHours,
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
