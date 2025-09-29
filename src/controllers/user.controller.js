import User from "../models/user.js";

// @desc    Upload Avatar
// @route   POST /api/users/avatar
// @access Private
export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatar } = req.body;

    if (!avatar) {
      return res.status(400).json({
        success: false,
        message: "Avatar URL is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.avatar = avatar;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      data: {
        avatar: user.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Add Favorite Venue
// @route   POST /api/users/favorite-venues/:venueId
// @access Private
export const addFavoriteVenue = async (req, res) => {
  try {
    const userId = req.user.id;
    const { venueId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.favoriteVenues.includes(venueId)) {
      user.favoriteVenues.push(venueId);
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: "Venue added to favorites",
      data: {
        favoriteVenues: user.favoriteVenues,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Remove Favorite Venue
// @route   DELETE /api/users/favorite-venues/:venueId
// @access Private
export const removeFavoriteVenue = async (req, res) => {
  try {
    const userId = req.user.id;
    const { venueId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.favoriteVenues = user.favoriteVenues.filter(
      (id) => !id.equals(venueId)
    );
    await user.save();

    res.status(200).json({
      success: true,
      message: "Venue removed from favorites",
      data: {
        favoriteVenues: user.favoriteVenues,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get User Stats
// @route   GET /api/users/stats
// @access Private
export const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalBookings: user.totalBookings,
          totalSpent: user.totalSpent,
          rewardPoints: user.rewardPoints,
          loyaltyTier: user.loyaltyTier,
          tierDiscount: user.tierDiscount,
          referralCount: user.referralCount,
          favoriteVenuesCount: user.favoriteVenues.length,
          accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)),
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

// @desc    Use Referral Code
// @route   POST /api/users/use-referral/:referralCode
// @access Private
export const useReferralCode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { referralCode } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.referredBy) {
      return res.status(400).json({
        success: false,
        message: "User has already used a referral code",
      });
    }

    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: "Invalid referral code",
      });
    }

    if (referrer._id.equals(userId)) {
      return res.status(400).json({
        success: false,
        message: "Cannot use your own referral code",
      });
    }

    // Apply referral benefits
    user.referredBy = referrer._id;
    referrer.referralCount += 1;

    // Add bonus points (basic implementation)
    const bonusPoints = 50;
    user.addPoints(bonusPoints, "referral");
    referrer.addPoints(bonusPoints, "referral");

    await Promise.all([user.save(), referrer.save()]);

    res.status(200).json({
      success: true,
      message: "Referral code applied successfully",
      data: {
        bonusPoints,
        referrerName: referrer.fullName,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Claim Birthday Voucher
// @route   POST /api/users/birthday-voucher
// @access Private
export const claimBirthdayVoucher = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: "Date of birth is required to claim birthday voucher",
      });
    }

    const currentYear = new Date().getFullYear();
    const birthday = new Date(user.dateOfBirth);
    birthday.setFullYear(currentYear);

    const today = new Date();
    const daysDiff = Math.floor((today - birthday) / (1000 * 60 * 60 * 24));

    // Check if birthday is within 7 days
    if (daysDiff < 0 || daysDiff > 7) {
      return res.status(400).json({
        success: false,
        message: "Birthday voucher can only be claimed within 7 days of your birthday",
      });
    }

    if (user.birthdayVoucherClaimed && user.lastBirthdayVoucherYear === currentYear) {
      return res.status(400).json({
        success: false,
        message: "Birthday voucher already claimed this year",
      });
    }

    // Award birthday bonus
    const birthdayPoints = 100;
    user.addPoints(birthdayPoints, "birthday");
    user.birthdayVoucherClaimed = true;
    user.lastBirthdayVoucherYear = currentYear;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Birthday voucher claimed successfully",
      data: {
        bonusPoints: birthdayPoints,
        totalPoints: user.rewardPoints,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Block User
// @route   POST /api/users/block/:userId
// @access Private
export const blockUser = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    if (currentUserId === userId) {
      return res.status(400).json({
        success: false,
        message: "Cannot block yourself",
      });
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    currentUser.blockUser(userId);
    await currentUser.save();

    res.status(200).json({
      success: true,
      message: "User blocked successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Unblock User
// @route   DELETE /api/users/block/:userId
// @access Private
export const unblockUser = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    currentUser.unblockUser(userId);
    await currentUser.save();

    res.status(200).json({
      success: true,
      message: "User unblocked successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Add Friend
// @route   POST /api/users/friends/:userId
// @access Private
export const addFriend = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    if (currentUserId === userId) {
      return res.status(400).json({
        success: false,
        message: "Cannot add yourself as friend",
      });
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    currentUser.addFriend(userId);
    await currentUser.save();

    res.status(200).json({
      success: true,
      message: "Friend added successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Remove Friend
// @route   DELETE /api/users/friends/:userId
// @access Private
export const removeFriend = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    currentUser.removeFriend(userId);
    await currentUser.save();

    res.status(200).json({
      success: true,
      message: "Friend removed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Friends List
// @route   GET /api/users/friends
// @access Private
export const getFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate("friends", "fullName avatar isOnline lastSeen");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        friends: user.friends,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update User Profile
// @route   PUT /api/users/profile
// @access Private
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      fullName,
      phone,
      dateOfBirth,
      gender,
      address,
      favoriteSports,
      notificationSettings
    } = req.body;

    // Build update object with allowed fields
    const updateFields = {};
    if (fullName) updateFields.fullName = fullName;
    if (phone) updateFields.phone = phone;
    if (dateOfBirth) updateFields.dateOfBirth = dateOfBirth;
    if (gender) updateFields.gender = gender;
    if (address) updateFields.address = address;
    if (favoriteSports) updateFields.favoriteSports = favoriteSports;
    if (notificationSettings) updateFields.notificationSettings = notificationSettings;

    // Check if email is being updated and if it's already taken
    if (req.body.email) {
      const existingUser = await User.findOne({ 
        email: req.body.email, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
      updateFields.email = req.body.email;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      {
        new: true,
        runValidators: true,
        select: '-password -emailVerificationToken -passwordResetToken'
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors,
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all users (for chat)
// @route   GET /api/users
// @access Private
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const currentUserId = req.user.id;

    // Build query
    let query = { _id: { $ne: currentUserId } }; // Exclude current user

    // Add search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password -emailVerificationToken -passwordResetToken')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ fullName: 1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
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