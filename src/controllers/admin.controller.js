/**
 * @fileoverview Admin Controller for Vic-Sports
 * @description Comprehensive admin management including dashboard statistics, user management,
 * venue management, booking management, review management, and financial reports
 */

import User from "../models/user.js";
import Booking from "../models/booking.js";
import Venue from "../models/venue.js";
import Court from "../models/court.js";
import Review from "../models/review.js";
import Tournament from "../models/tournament.js";
import { sendTemplatedEmail } from "../utils/sendEmail.js";

// ==================== UTILITY FUNCTIONS ====================

// Convert FE pattern like "/text/i" to RegExp
const toRegexIfPattern = (value) => {
  if (typeof value !== "string") return value;
  const match = value.match(/^\/(.*)\/i$/);
  if (match) {
    try {
      return new RegExp(match[1], "i");
    } catch {
      return value;
    }
  }
  return value;
};

// ==================== ADMIN DASHBOARD STATISTICS ====================

/**
 * Get admin dashboard statistics
 * @route GET /api/admin/stats
 * @access Private (Admin only)
 */
export const getAdminStats = async (req, res, next) => {
  try {
    // Get total users by role
    const totalUsers = await User.countDocuments();
    const totalCustomers = await User.countDocuments({ role: "customer" });
    const totalOwners = await User.countDocuments({ role: "owner" });
    const totalCoaches = await User.countDocuments({ role: "coach" });

    // Get total bookings
    const totalBookings = await Booking.countDocuments();
    const completedBookings = await Booking.countDocuments({ status: "completed" });
    const pendingBookings = await Booking.countDocuments({ status: "pending" });

    // Get total revenue from completed bookings
    const revenueData = await Booking.aggregate([
      { $match: { status: "completed", paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

    // Calculate revenue comparison with previous month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const currentMonthRevenue = await Booking.aggregate([
      {
        $match: {
          status: "completed",
          paymentStatus: "paid",
          createdAt: {
            $gte: new Date(currentYear, currentMonth, 1),
            $lt: new Date(currentYear, currentMonth + 1, 1),
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    const previousMonthRevenue = await Booking.aggregate([
      {
        $match: {
          status: "completed",
          paymentStatus: "paid",
          createdAt: {
            $gte: new Date(currentYear, currentMonth - 1, 1),
            $lt: new Date(currentYear, currentMonth, 1),
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    const currentMonthTotal =
      currentMonthRevenue.length > 0 ? currentMonthRevenue[0].total : 0;
    const previousMonthTotal =
      previousMonthRevenue.length > 0 ? previousMonthRevenue[0].total : 0;

    const revenueChange =
      previousMonthTotal > 0
        ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
        : 0;

    // Get total venues
    const totalVenues = await Venue.countDocuments();
    const verifiedVenues = await Venue.countDocuments({ isVerified: true });
    const pendingVenues = await Venue.countDocuments({ isVerified: false });

    // Get total courts
    const totalCourts = await Court.countDocuments();

    // Get total tournaments
    const totalTournaments = await Tournament.countDocuments();
    const ongoingTournaments = await Tournament.countDocuments({ status: "ongoing" });

    // Average rating
    const ratingAgg = await Review.aggregate([
      { $group: { _id: null, avg: { $avg: "$overallRating" }, count: { $sum: 1 } } },
    ]);
    const averageRating = ratingAgg[0]?.avg || 0;
    const totalReviews = ratingAgg[0]?.count || 0;

    // Booking status distribution
    const statusAgg = await Booking.aggregate([
      { $group: { _id: "$status", value: { $sum: 1 } } },
    ]);
    const bookingStatusDistribution = statusAgg.map((s) => ({
      name: s._id,
      value: s.value,
    }));

    // Recent bookings
    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "fullName email")
      .populate("venue", "name")
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalCustomers,
        totalOwners,
        totalCoaches,
        totalBookings,
        completedBookings,
        pendingBookings,
        totalRevenue,
        totalRevenueChange: Math.round(revenueChange * 100) / 100,
        totalVenues,
        verifiedVenues,
        pendingVenues,
        totalCourts,
        totalTournaments,
        ongoingTournaments,
        averageRating,
        totalReviews,
        bookingStatusDistribution,
        recentBookings,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ==================== USER MANAGEMENT ====================

/**
 * Get all users with pagination and filters
 * @route GET /api/admin/users
 * @access Private (Admin only)
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const current = Math.max(parseInt(req.query.current) || 1, 1);
    const pageSize = Math.max(parseInt(req.query.pageSize) || 10, 1);

    const filter = {};
    if (req.query.email) filter.email = toRegexIfPattern(req.query.email);
    if (req.query.fullName) filter.fullName = toRegexIfPattern(req.query.fullName);
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;

    const gte = req.query["createdAt>="];
    const lte = req.query["createdAt<="];
    if (gte || lte) {
      filter.createdAt = {};
      if (gte) filter.createdAt.$gte = new Date(gte);
      if (lte) filter.createdAt.$lte = new Date(lte);
    }

    let sort = "-createdAt";
    if (typeof req.query.sort === "string" && req.query.sort.trim().length > 0) {
      sort = req.query.sort;
    }

    const skip = (current - 1) * pageSize;

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).sort(sort).skip(skip).limit(pageSize).lean(),
    ]);

    const pages = Math.ceil(total / pageSize) || 0;

    return res.status(200).json({
      message: "Success",
      statusCode: 200,
      data: {
        meta: { current, pageSize, pages, total },
        result: users,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get user details by ID
 * @route GET /api/admin/users/:userId
 * @access Private (Admin only)
 */
export const getUserDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found", statusCode: 404 });
    }

    // Get user's booking statistics
    const bookingStats = await Booking.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalSpent: { $sum: "$totalPrice" },
        },
      },
    ]);

    return res.status(200).json({
      message: "Success",
      statusCode: 200,
      data: {
        ...user,
        bookingStats,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update user by admin
 * @route PUT /api/admin/users/:userId
 * @access Private (Admin only)
 */
export const updateUserByAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const allowed = [
      "fullName",
      "phone",
      "role",
      "status",
      "gender",
      "dateOfBirth",
      "rewardPoints",
      "address",
      "loyaltyTier",
    ];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const before = await User.findById(userId).lean();
    if (!before) {
      return res.status(404).json({ message: "User not found", statusCode: 404 });
    }

    await User.findByIdAndUpdate(userId, { $set: updates }, { runValidators: true });

    const user = await User.findById(userId).lean();

    // Send notification emails on status change
    try {
      if (before.status !== user.status) {
        if (user.status === "BANNED") {
          await sendTemplatedEmail({
            email: user.email,
            templateType: "ACCOUNT_BANNED",
            templateData: { name: user.fullName },
          });
        }
        if (before.status === "BANNED" && user.status === "ACTIVE") {
          await sendTemplatedEmail({
            email: user.email,
            templateType: "ACCOUNT_UNBANNED",
            templateData: { name: user.fullName },
          });
        }
      }
    } catch (_) {}

    return res.status(200).json({ message: "Updated", statusCode: 200, data: user });
  } catch (err) {
    next(err);
  }
};

/**
 * Ban user
 * @route PUT /api/admin/users/:userId/ban
 * @access Private (Admin only)
 */
export const banUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { banReason } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        status: "BANNED",
        isBlocked: true,
        blockedReason: banReason || "Violation of terms of service",
        blockedBy: req.user._id,
      },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found", statusCode: 404 });
    }

    // Send ban notification email
    try {
      if (user.email) {
        await sendTemplatedEmail({
          email: user.email,
          templateType: "ACCOUNT_BANNED",
          templateData: {
            name: user.fullName,
            reason: banReason || "Violation of terms of service",
          },
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: "User banned successfully",
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Unban user
 * @route PUT /api/admin/users/:userId/unban
 * @access Private (Admin only)
 */
export const unbanUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        status: "ACTIVE",
        isBlocked: false,
        blockedReason: null,
        blockedBy: null,
        blockedUntil: null,
      },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found", statusCode: 404 });
    }

    // Send unban notification email
    try {
      if (user.email) {
        await sendTemplatedEmail({
          email: user.email,
          templateType: "ACCOUNT_UNBANNED",
          templateData: { name: user.fullName },
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: "User unbanned successfully",
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// ==================== VENUE MANAGEMENT ====================

/**
 * Get all venues with filters (for admin management)
 * @route GET /api/admin/venues
 * @access Private (Admin only)
 */
export const getPendingVenues = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (typeof req.query.name === "string") {
      const m = req.query.name.match(/^\/(.*)\/i$/);
      filter.name = m ? new RegExp(m[1], "i") : req.query.name;
    }
    if (typeof req.query.isVerified === "string") {
      filter.isVerified = req.query.isVerified === "true";
    }
    if (typeof req.query.isActive === "string") {
      filter.isActive = req.query.isActive === "true";
    }
    if (typeof req.query.moderationStatus === "string") {
      filter.moderationStatus = req.query.moderationStatus;
    }

    const sort = typeof req.query.sort === "string" ? req.query.sort : "-createdAt";

    const [total, venues] = await Promise.all([
      Venue.countDocuments(filter),
      Venue.find(filter)
        .populate("ownerId", "fullName email phone")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
    ]);

    return res.status(200).json({
      message: "Success",
      statusCode: 200,
      data: {
        meta: {
          current: parseInt(page),
          pageSize: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
          total,
        },
        result: venues,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve venue
 * @route PUT /api/admin/venues/:venueId/approve
 * @access Private (Admin only)
 */
export const approveVenue = async (req, res, next) => {
  try {
    const { venueId } = req.params;
    const { verificationNotes } = req.body;

    const venue = await Venue.findByIdAndUpdate(
      venueId,
      {
        isVerified: true,
        moderationStatus: "approved",
        verifiedAt: new Date(),
        verificationNotes: verificationNotes || "Approved by admin",
      },
      { new: true }
    );

    if (!venue) {
      return res.status(404).json({ message: "Venue not found", statusCode: 404 });
    }

    // Notify owner
    try {
      const owner = await User.findById(venue.ownerId);
      if (owner?.email) {
        await sendTemplatedEmail({
          email: owner.email,
          templateType: "VENUE_APPROVED",
          templateData: {
            ownerName: owner.fullName,
            venueName: venue.name,
            notes: verificationNotes,
          },
        });
      }
    } catch (_) {}

    return res.status(200).json({
      message: "Venue approved",
      statusCode: 200,
      data: venue,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reject venue
 * @route PUT /api/admin/venues/:venueId/reject
 * @access Private (Admin only)
 */
export const rejectVenue = async (req, res, next) => {
  try {
    const { venueId } = req.params;
    const { verificationNotes } = req.body;

    const venue = await Venue.findByIdAndUpdate(
      venueId,
      {
        isVerified: false,
        moderationStatus: "rejected",
        verificationNotes: verificationNotes || "Rejected by admin",
      },
      { new: true }
    );

    if (!venue) {
      return res.status(404).json({ message: "Venue not found", statusCode: 404 });
    }

    // Notify owner
    try {
      const owner = await User.findById(venue.ownerId);
      if (owner?.email) {
        await sendTemplatedEmail({
          email: owner.email,
          templateType: "VENUE_REJECTED",
          templateData: {
            ownerName: owner.fullName,
            venueName: venue.name,
            reason: verificationNotes,
          },
        });
      }
    } catch (_) {}

    return res.status(200).json({
      message: "Venue rejected",
      statusCode: 200,
      data: venue,
    });
  } catch (err) {
    next(err);
  }
};

// ==================== BOOKING MANAGEMENT ====================

/**
 * Get all bookings with filters
 * @route GET /api/admin/bookings
 * @access Private (Admin only)
 */
export const getAllBookings = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "fullName email phone")
        .populate("venue", "name")
        .populate("court", "name sportType")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update booking status
 * @route PUT /api/admin/bookings/:bookingId/status
 * @access Private (Admin only)
 */
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { status, cancellationReason } = req.body;

    const updates = { status };
    if (status === "cancelled") {
      updates.cancelledAt = new Date();
      if (cancellationReason) updates.cancellationReason = cancellationReason;
    }
    if (status === "confirmed") {
      updates.confirmedAt = new Date();
    }

    const booking = await Booking.findByIdAndUpdate(bookingId, updates, { new: true })
      .populate("user", "fullName email")
      .populate("venue", "name");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found", statusCode: 404 });
    }

    return res.status(200).json({
      success: true,
      message: "Booking status updated",
      data: booking,
    });
  } catch (err) {
    next(err);
  }
};

// ==================== REVIEW MANAGEMENT ====================

/**
 * Get all reviews with filters
 * @route GET /api/admin/reviews
 * @access Private (Admin only)
 */
export const getAllReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.isApproved !== undefined) {
      filter.isApproved = req.query.isApproved === "true";
    }

    const [total, reviews] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customerId", "fullName email")
        .populate("venueId", "name")
        .populate("courtId", "name sportType")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve review
 * @route PUT /api/admin/reviews/:reviewId/approve
 * @access Private (Admin only)
 */
export const approveReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { isApproved: true },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: "Review not found", statusCode: 404 });
    }

    return res.status(200).json({
      success: true,
      message: "Review approved",
      data: review,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete review
 * @route DELETE /api/admin/reviews/:reviewId
 * @access Private (Admin only)
 */
export const deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByIdAndDelete(reviewId);

    if (!review) {
      return res.status(404).json({ message: "Review not found", statusCode: 404 });
    }

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reject review
 * @route PUT /api/admin/reviews/:reviewId/reject
 * @access Private (Admin only)
 */
export const rejectReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { isApproved: false },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: "Review not found", statusCode: 404 });
    }

    return res.status(200).json({
      success: true,
      message: "Review rejected",
      data: review,
    });
  } catch (err) {
    next(err);
  }
};

// ==================== PENDING APPROVALS ====================

/**
 * Get pending reviews
 * @route GET /api/admin/pending-reviews
 * @access Private (Admin only)
 */
export const getPendingReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ isApproved: false })
      .sort({ createdAt: -1 })
      .populate("customerId", "fullName email")
      .populate("venueId", "name")
      .lean();

    return res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get pending coaches
 * @route GET /api/admin/pending-coaches
 * @access Private (Admin only)
 */
export const getPendingCoaches = async (req, res, next) => {
  try {
    // Assuming coaches need some verification - customize based on your coach model
    const coaches = await User.find({ role: "coach", isEmailVerified: false })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: coaches,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify coach
 * @route PUT /api/admin/coaches/:coachId/verify
 * @access Private (Admin only)
 */
export const verifyCoach = async (req, res, next) => {
  try {
    const { coachId } = req.params;

    const coach = await User.findByIdAndUpdate(
      coachId,
      { isEmailVerified: true, status: "ACTIVE" },
      { new: true }
    );

    if (!coach) {
      return res.status(404).json({ message: "Coach not found", statusCode: 404 });
    }

    return res.status(200).json({
      success: true,
      message: "Coach verified successfully",
      data: coach,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get pending owners
 * @route GET /api/admin/pending-owners
 * @access Private (Admin only)
 */
export const getPendingOwners = async (req, res, next) => {
  try {
    const owners = await User.find({ role: "owner", isEmailVerified: false })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: owners,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify owner
 * @route PUT /api/admin/owners/:ownerId/verify
 * @access Private (Admin only)
 */
export const verifyOwner = async (req, res, next) => {
  try {
    const { ownerId } = req.params;

    const owner = await User.findByIdAndUpdate(
      ownerId,
      { isEmailVerified: true, status: "ACTIVE" },
      { new: true }
    );

    if (!owner) {
      return res.status(404).json({ message: "Owner not found", statusCode: 404 });
    }

    return res.status(200).json({
      success: true,
      message: "Owner verified successfully",
      data: owner,
    });
  } catch (err) {
    next(err);
  }
};

// ==================== FINANCIAL REPORTS & ANALYTICS ====================

/**
 * Get revenue data by period
 * @route GET /api/admin/revenue
 * @access Private (Admin only)
 */
export const getAdminRevenueData = async (req, res, next) => {
  try {
    const period = req.query.period || "monthly";

    let groupBy;
    if (period === "daily") {
      groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    } else if (period === "weekly") {
      groupBy = { $dateToString: { format: "%Y-%U", date: "$createdAt" } };
    } else {
      groupBy = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
    }

    const revenueData = await Booking.aggregate([
      {
        $match: {
          status: "completed",
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: groupBy,
          totalRevenue: { $sum: "$totalPrice" },
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: revenueData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get user growth data
 * @route GET /api/admin/user-growth
 * @access Private (Admin only)
 */
export const getAdminUserGrowthData = async (req, res, next) => {
  try {
    const period = req.query.period || "monthly";

    let groupBy;
    if (period === "daily") {
      groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    } else if (period === "weekly") {
      groupBy = { $dateToString: { format: "%Y-%U", date: "$createdAt" } };
    } else {
      groupBy = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
    }

    const userGrowthData = await User.aggregate([
      {
        $group: {
          _id: groupBy,
          customers: { $sum: { $cond: [{ $eq: ["$role", "customer"] }, 1, 0] } },
          owners: { $sum: { $cond: [{ $eq: ["$role", "owner"] }, 1, 0] } },
          coaches: { $sum: { $cond: [{ $eq: ["$role", "coach"] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: userGrowthData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get booking trends data
 * @route GET /api/admin/booking-trends
 * @access Private (Admin only)
 */
export const getBookingTrends = async (req, res, next) => {
  try {
    const period = req.query.period || "monthly";

    let groupBy;
    if (period === "daily") {
      groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    } else if (period === "weekly") {
      groupBy = { $dateToString: { format: "%Y-%U", date: "$createdAt" } };
    } else {
      groupBy = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
    }

    const bookingTrends = await Booking.aggregate([
      {
        $match: {
          status: { $in: ["completed", "confirmed", "pending"] },
        },
      },
      {
        $group: {
          _id: groupBy,
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: bookingTrends,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get top venues by revenue
 * @route GET /api/admin/top-venues
 * @access Private (Admin only)
 */
export const getTopVenues = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const topVenues = await Booking.aggregate([
      {
        $match: {
          status: "completed",
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: "$venue",
          revenue: { $sum: "$totalPrice" },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "venues",
          localField: "_id",
          foreignField: "_id",
          as: "venueInfo",
        },
      },
      { $unwind: "$venueInfo" },
      {
        $project: {
          _id: 0,
          venueName: "$venueInfo.name",
          revenue: 1,
          bookings: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: topVenues,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get dashboard analytics summary
 * @route GET /api/admin/analytics
 * @access Private (Admin only)
 */
export const getDashboardAnalytics = async (req, res, next) => {
  try {
    // This combines various analytics data
    const [revenueData, userGrowth, bookingTrends, topVenues] = await Promise.all([
      getAdminRevenueData(req, res, () => {}),
      getAdminUserGrowthData(req, res, () => {}),
      getBookingTrends(req, res, () => {}),
      getTopVenues(req, res, () => {}),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        revenue: revenueData,
        userGrowth,
        bookingTrends,
        topVenues,
      },
    });
  } catch (err) {
    next(err);
  }
};
