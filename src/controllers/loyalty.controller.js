import User from "../models/user.js";
import Booking from "../models/booking.js";

// @desc    Get User Loyalty Info
// @route   GET /api/loyalty/info
// @access Private
export const getLoyaltyInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Calculate tier benefits
    const tierBenefits = {
      Bronze: { discount: 0, pointsMultiplier: 1, specialBenefits: [] },
      Silver: { discount: 5, pointsMultiplier: 1.1, specialBenefits: ["Priority Support"] },
      Gold: { discount: 10, pointsMultiplier: 1.2, specialBenefits: ["Priority Support", "Free Cancellation"] },
      Diamond: { discount: 15, pointsMultiplier: 1.3, specialBenefits: ["Priority Support", "Free Cancellation", "VIP Access"] },
    };

    const currentTier = tierBenefits[user.loyaltyTier];
    const nextTier = getNextTier(user.loyaltyTier);
    const pointsToNextTier = getPointsToNextTier(user.totalSpent, user.loyaltyTier);

    res.status(200).json({
      success: true,
      data: {
        loyaltyInfo: {
          currentTier: user.loyaltyTier,
          rewardPoints: user.rewardPoints,
          totalSpent: user.totalSpent,
          tierBenefits: currentTier,
          nextTier,
          pointsToNextTier,
          referralCode: user.referralCode,
          referralCount: user.referralCount,
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

// @desc    Get Points History
// @route   GET /api/loyalty/points-history
// @access Private
export const getPointsHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Get bookings with points earned
    const bookings = await Booking.find({
      customerId: userId,
      pointsEarned: { $gt: 0 },
    })
      .populate("venueId", "name")
      .populate("courtId", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments({
      customerId: userId,
      pointsEarned: { $gt: 0 },
    });

    // Format points history
    const pointsHistory = bookings.map(booking => ({
      id: booking._id,
      type: "booking",
      points: booking.pointsEarned,
      description: `Booking at ${booking.venueId.name}`,
      date: booking.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        pointsHistory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalEntries: total,
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

// @desc    Use Points for Discount
// @route   POST /api/loyalty/use-points
// @access Private
export const usePointsForDiscount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { points, bookingId } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid points amount is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has enough points
    if (user.rewardPoints < points) {
      return res.status(400).json({
        success: false,
        message: "Insufficient points",
      });
    }

    // Calculate discount (1 point = 100 VND)
    const discountAmount = points * 100;

    // Use points
    const result = user.usePoints(points);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    await user.save();

    // If bookingId provided, update booking
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking && booking.customerId.equals(userId)) {
        booking.pointsUsed = points;
        booking.discountApplied = discountAmount;
        booking.finalPrice = Math.max(0, booking.totalPrice - discountAmount);
        await booking.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Points used successfully",
      data: {
        pointsUsed: points,
        discountAmount,
        remainingPoints: user.rewardPoints,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Tier Benefits
// @route   GET /api/loyalty/tier-benefits
// @access Public
export const getTierBenefits = async (req, res) => {
  try {
    const tierBenefits = {
      Bronze: {
        minSpent: 0,
        discount: 0,
        pointsMultiplier: 1,
        specialBenefits: [],
        description: "Start your journey with VIC Sports",
      },
      Silver: {
        minSpent: 1000000, // 1M VND
        discount: 5,
        pointsMultiplier: 1.1,
        specialBenefits: ["Priority Support"],
        description: "Enjoy priority support and extra points",
      },
      Gold: {
        minSpent: 5000000, // 5M VND
        discount: 10,
        pointsMultiplier: 1.2,
        specialBenefits: ["Priority Support", "Free Cancellation"],
        description: "Premium benefits and flexible booking",
      },
      Diamond: {
        minSpent: 10000000, // 10M VND
        discount: 15,
        pointsMultiplier: 1.3,
        specialBenefits: ["Priority Support", "Free Cancellation", "VIP Access"],
        description: "Ultimate VIP experience",
      },
    };

    res.status(200).json({
      success: true,
      data: {
        tierBenefits,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Referral Stats
// @route   GET /api/loyalty/referral-stats
// @access Private
export const getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get referred users
    const referredUsers = await User.find({ referredBy: userId })
      .select("fullName createdAt totalSpent");

    const totalReferralEarnings = referredUsers.reduce((sum, user) => sum + user.totalSpent, 0);

    res.status(200).json({
      success: true,
      data: {
        referralStats: {
          referralCode: user.referralCode,
          referralCount: user.referralCount,
          referredUsers: referredUsers.length,
          totalReferralEarnings,
          referredUsersList: referredUsers,
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

// @desc    Generate Referral Link
// @route   GET /api/loyalty/referral-link
// @access Private
export const getReferralLink = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const referralLink = `${process.env.FRONTEND_URL}/register?ref=${user.referralCode}`;

    res.status(200).json({
      success: true,
      data: {
        referralLink,
        referralCode: user.referralCode,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Helper functions
const getNextTier = (currentTier) => {
  const tiers = ["Bronze", "Silver", "Gold", "Diamond"];
  const currentIndex = tiers.indexOf(currentTier);
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
};

const getPointsToNextTier = (totalSpent, currentTier) => {
  const tierThresholds = {
    Bronze: 1000000,   // 1M VND
    Silver: 5000000,   // 5M VND
    Gold: 10000000,    // 10M VND
    Diamond: null,     // Highest tier
  };

  const nextTier = getNextTier(currentTier);
  if (!nextTier) return 0;

  const nextThreshold = tierThresholds[nextTier];
  return Math.max(0, nextThreshold - totalSpent);
};
