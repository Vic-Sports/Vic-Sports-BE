import Coach from "../models/coach.js";
import User from "../models/user.js";
import Booking from "../models/booking.js";
import mongoose from "mongoose";

// @desc    Create Coach Profile
// @route   POST /api/coaches/profile
// @access Private
export const createCoachProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      specializedSports,
      experience,
      certifications,
      bio,
      achievements,
      hourlyRate,
      availability,
    } = req.body;

    // Check if coach profile already exists
    const existingCoach = await Coach.findOne({ userId });
    if (existingCoach) {
      return res.status(400).json({
        success: false,
        message: "Coach profile already exists",
      });
    }

    // Validate required fields
    if (!specializedSports || !experience || !hourlyRate) {
      return res.status(400).json({
        success: false,
        message: "Specialized sports, experience, and hourly rate are required",
      });
    }

    const coach = await Coach.create({
      userId,
      specializedSports,
      experience,
      certifications,
      bio,
      achievements,
      hourlyRate,
      availability,
    });

    res.status(201).json({
      success: true,
      message: "Coach profile created successfully",
      data: {
        coach,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get All Coaches
// @route   GET /api/coaches
// @access Public
export const getAllCoaches = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sportType,
      minRate,
      maxRate,
      experience,
      verified,
      search,
      sortBy = "ratings.average",
      sortOrder = "desc",
    } = req.query;

    const query = { isActive: true };

    // Filter by sport type
    if (sportType) {
      query.specializedSports = sportType;
    }

    // Filter by hourly rate
    if (minRate) query.hourlyRate = { $gte: parseInt(minRate) };
    if (maxRate) query.hourlyRate = { ...query.hourlyRate, $lte: parseInt(maxRate) };

    // Filter by experience
    if (experience) {
      query.experience = { $gte: parseInt(experience) };
    }

    // Filter by verification status
    if (verified !== undefined) {
      query.isVerified = verified === "true";
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const coaches = await Coach.find(query)
      .populate("userId", "fullName avatar email phone")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Coach.countDocuments(query);

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

// @desc    Get Coach by ID
// @route   GET /api/coaches/:coachId
// @access Public
export const getCoachById = async (req, res) => {
  try {
    const { coachId } = req.params;

    const coach = await Coach.findById(coachId)
      .populate("userId", "fullName avatar email phone");

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        coach,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update Coach Profile
// @route   PUT /api/coaches/profile
// @access Private
export const updateCoachProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    // Update coach fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        coach[key] = updateData[key];
      }
    });

    await coach.save();

    res.status(200).json({
      success: true,
      message: "Coach profile updated successfully",
      data: {
        coach,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Coach Sessions
// @route   GET /api/coaches/sessions
// @access Private
export const getCoachSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const query = { coachId: userId };
    if (status) query.status = status;

    const sessions = await Booking.find(query)
      .populate("customerId", "fullName avatar")
      .populate("courtId", "name sportType")
      .populate("venueId", "name address")
      .sort({ bookingDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        sessions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalSessions: total,
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

// @desc    Get Coach Earnings
// @route   GET /api/coaches/earnings
// @access Private
export const getCoachEarnings = async (req, res) => {
  try {
    const userId = req.user.id;
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

    const earnings = await Booking.aggregate([
      {
        $match: {
          coachId: mongoose.Types.ObjectId(userId),
          status: "completed",
          bookingDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$coachFee" },
          totalSessions: { $sum: 1 },
          averageEarningsPerSession: { $avg: "$coachFee" },
        },
      },
    ]);

    const result = earnings.length > 0 ? earnings[0] : {
      totalEarnings: 0,
      totalSessions: 0,
      averageEarningsPerSession: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        earnings: result,
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

// @desc    Search Coaches
// @route   GET /api/coaches/search
// @access Public
export const searchCoaches = async (req, res) => {
  try {
    const {
      sportType,
      city,
      date,
      timeSlot,
      page = 1,
      limit = 10,
    } = req.query;

    const query = { isActive: true, isVerified: true };

    // Filter by sport type
    if (sportType) {
      query.specializedSports = sportType;
    }

    const coaches = await Coach.find(query)
      .populate("userId", "fullName avatar")
      .sort({ "ratings.average": -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter by availability if date and timeSlot provided
    let availableCoaches = coaches;
    if (date && timeSlot) {
      availableCoaches = coaches.filter(coach => {
        const dayOfWeek = new Date(date).getDay();
        const availability = coach.availability.find(avail => avail.dayOfWeek === dayOfWeek);
        
        if (!availability) return false;
        
        return timeSlot >= availability.startTime && timeSlot <= availability.endTime;
      });
    }

    res.status(200).json({
      success: true,
      data: {
        coaches: availableCoaches,
        searchParams: {
          sportType,
          city,
          date,
          timeSlot,
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

// @desc    Upload Coach Certifications
// @route   POST /api/coaches/certifications
// @access Private
export const uploadCertifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { certifications } = req.body;

    if (!certifications || !Array.isArray(certifications)) {
      return res.status(400).json({
        success: false,
        message: "Certifications array is required",
      });
    }

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    coach.certifications = [...(coach.certifications || []), ...certifications];
    await coach.save();

    res.status(200).json({
      success: true,
      message: "Certifications uploaded successfully",
      data: {
        certifications: coach.certifications,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Coach Dashboard Stats
// @route   GET /api/coaches/dashboard
// @access Private
export const getCoachDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    // Get recent sessions
    const recentSessions = await Booking.find({ coachId: userId })
      .populate("customerId", "fullName")
      .populate("venueId", "name")
      .sort({ bookingDate: -1 })
      .limit(5);

    // Get earnings summary
    const earningsSummary = await Booking.aggregate([
      {
        $match: {
          coachId: mongoose.Types.ObjectId(userId),
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$coachFee" },
          totalSessions: { $sum: 1 },
          thisMonthEarnings: {
            $sum: {
              $cond: [
                {
                  $gte: ["$bookingDate", new Date(new Date().getFullYear(), new Date().getMonth(), 1)],
                },
                "$coachFee",
                0,
              ],
            },
          },
        },
      },
    ]);

    const stats = earningsSummary.length > 0 ? earningsSummary[0] : {
      totalEarnings: 0,
      totalSessions: 0,
      thisMonthEarnings: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        coach: {
          id: coach._id,
          isVerified: coach.isVerified,
          ratings: coach.ratings,
          totalSessions: coach.totalSessions,
        },
        stats,
        recentSessions,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
