import User from "../models/user.js";
import Venue from "../models/venue.js";
import Coach from "../models/coach.js";
import Owner from "../models/owner.js";
import Review from "../models/review.js";

// @desc    Get All Users (Admin)
// @route   GET /api/admin/users
// @access Private (Admin)
export const getAllUsers = async (req, res) => {
  try {
    const {
      page: pageRaw = 1,
      limit: limitRaw = 10,
      role,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Coerce to numbers and enforce sane bounds
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 10));

    const query = {};

    // Filter by role
    if (role) {
      query.role = role;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const users = await User.find(query)
      .select("-password -emailVerificationToken -passwordResetToken")
      .sort(sortOptions)
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
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

// @desc    Get User Details (Admin)
// @route   GET /api/admin/users/:userId
// @access Private (Admin)
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("-password -emailVerificationToken -passwordResetToken")
      .populate("favoriteVenues", "name")
      .populate("friends", "fullName avatar")
      .populate("blockedUsers", "fullName");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Ban/Unban User (Admin)
// @route   PUT /api/admin/users/:userId/ban
// @access Private (Admin)
export const banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body;
    const adminId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Cannot ban admin users",
      });
    }

    user.isBlocked = true;
    user.blockedReason = reason;
    user.blockedBy = adminId;
    user.status = "BANNED";

    if (duration) {
      user.blockedUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User banned successfully",
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          status: user.status,
          isBlocked: user.isBlocked,
          blockedReason: user.blockedReason,
          blockedUntil: user.blockedUntil,
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

// @desc    Unban User (Admin)
// @route   PUT /api/admin/users/:userId/unban
// @access Private (Admin)
export const unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isBlocked = false;
    user.blockedReason = undefined;
    user.blockedBy = undefined;
    user.blockedUntil = undefined;
    user.status = "ACTIVE";

    await user.save();

    res.status(200).json({
      success: true,
      message: "User unbanned successfully",
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          status: user.status,
          isBlocked: user.isBlocked,
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

// @desc    Get Venues Pending Approval (Admin)
// @route   GET /api/admin/venues/pending
// @access Private (Admin)
export const getPendingVenues = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const venues = await Venue.find({ isVerified: false })
      .populate("ownerId", "fullName email phone")
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Venue.countDocuments({ isVerified: false });

    res.status(200).json({
      success: true,
      data: {
        venues,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalVenues: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
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

// @desc    Approve Venue (Admin)
// @route   PUT /api/admin/venues/:venueId/approve
// @access Private (Admin)
export const approveVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const adminId = req.user.id;

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    venue.isVerified = true;
    venue.verifiedAt = new Date();
    await venue.save();

    res.status(200).json({
      success: true,
      message: "Venue approved successfully",
      data: {
        venue: {
          id: venue._id,
          name: venue.name,
          isVerified: venue.isVerified,
          verifiedAt: venue.verifiedAt,
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

// @desc    Reject Venue (Admin)
// @route   PUT /api/admin/venues/:venueId/reject
// @access Private (Admin)
export const rejectVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { reason } = req.body;

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    venue.isActive = false;
    await venue.save();

    res.status(200).json({
      success: true,
      message: "Venue rejected successfully",
      data: {
        venue: {
          id: venue._id,
          name: venue.name,
          isActive: venue.isActive,
          rejectionReason: reason,
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

// @desc    Get Coach Applications (Admin)
// @route   GET /api/admin/coaches/pending
// @access Private (Admin)
export const getPendingCoaches = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const coaches = await Coach.find({ isVerified: false })
      .populate("userId", "fullName email phone")
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Coach.countDocuments({ isVerified: false });

    res.status(200).json({
      success: true,
      data: {
        coaches,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCoaches: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
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

// @desc    Verify Coach (Admin)
// @route   PUT /api/admin/coaches/:coachId/verify
// @access Private (Admin)
export const verifyCoach = async (req, res) => {
  try {
    const { coachId } = req.params;

    const coach = await Coach.findById(coachId);
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    coach.isVerified = true;
    await coach.save();

    // Update user role to coach
    const user = await User.findById(coach.userId);
    if (user) {
      user.role = "coach";
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: "Coach verified successfully",
      data: {
        coach: {
          id: coach._id,
          isVerified: coach.isVerified,
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

// @desc    Get Owner Applications (Admin)
// @route   GET /api/admin/owners/pending
// @access Private (Admin)
export const getPendingOwners = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const owners = await Owner.find({ isVerified: false })
      .populate("userId", "fullName email phone")
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Owner.countDocuments({ isVerified: false });

    res.status(200).json({
      success: true,
      data: {
        owners,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalOwners: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
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

// @desc    Verify Owner (Admin)
// @route   PUT /api/admin/owners/:ownerId/verify
// @access Private (Admin)
export const verifyOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;

    const owner = await Owner.findById(ownerId);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
      });
    }

    owner.isVerified = true;
    await owner.save();

    // Update user role to owner
    const user = await User.findById(owner.userId);
    if (user) {
      user.role = "owner";
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: "Owner verified successfully",
      data: {
        owner: {
          id: owner._id,
          isVerified: owner.isVerified,
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

// @desc    Get Reviews for Moderation (Admin)
// @route   GET /api/admin/reviews/pending
// @access Private (Admin)
export const getPendingReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ isApproved: false })
      .populate("customerId", "fullName avatar")
      .populate("venueId", "name")
      .populate("courtId", "name")
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ isApproved: false });

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalReviews: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
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

// @desc    Approve Review (Admin)
// @route   PUT /api/admin/reviews/:reviewId/approve
// @access Private (Admin)
export const approveReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.isApproved = true;
    await review.save();

    // Update venue rating
    const venue = await Venue.findById(review.venueId);
    if (venue) {
      const allReviews = await Review.find({ venueId: venue._id, isApproved: true });
      const totalRating = allReviews.reduce((sum, r) => sum + r.overallRating, 0);
      venue.ratings.average = totalRating / allReviews.length;
      venue.ratings.count = allReviews.length;
      await venue.save();
    }

    res.status(200).json({
      success: true,
      message: "Review approved successfully",
      data: {
        review: {
          id: review._id,
          isApproved: review.isApproved,
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

// @desc    Reject Review (Admin)
// @route   PUT /api/admin/reviews/:reviewId/reject
// @access Private (Admin)
export const rejectReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.isApproved = false;
    await review.save();

    res.status(200).json({
      success: true,
      message: "Review rejected successfully",
      data: {
        review: {
          id: review._id,
          isApproved: review.isApproved,
          rejectionReason: reason,
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

// @desc    Get Dashboard Analytics (Admin)
// @route   GET /api/admin/dashboard
// @access Private (Admin)
export const getDashboardAnalytics = async (req, res) => {
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

    // Get basic statistics
    const [
      totalUsers,
      totalVenues,
      totalBookings,
      totalRevenue,
      newUsers,
      pendingVenues,
      pendingCoaches,
      pendingOwners,
      pendingReviews,
    ] = await Promise.all([
      User.countDocuments(),
      Venue.countDocuments({ isActive: true }),
      // Booking.countDocuments(), // Will be implemented when booking model is ready
      // Booking.aggregate([{ $group: { _id: null, total: { $sum: "$finalPrice" } } }]),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      Venue.countDocuments({ isVerified: false }),
      Coach.countDocuments({ isVerified: false }),
      Owner.countDocuments({ isVerified: false }),
      Review.countDocuments({ isApproved: false }),
    ]);

    // Get user statistics by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get venue statistics
    const venuesByCity = await Venue.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$address.city",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        analytics: {
          overview: {
            totalUsers,
            totalVenues,
            totalBookings: 0, // Placeholder
            totalRevenue: 0, // Placeholder
            newUsers,
          },
          pending: {
            venues: pendingVenues,
            coaches: pendingCoaches,
            owners: pendingOwners,
            reviews: pendingReviews,
          },
          usersByRole,
          venuesByCity,
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
