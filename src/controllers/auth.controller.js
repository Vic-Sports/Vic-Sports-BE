import crypto from "crypto";
import jwt from "jsonwebtoken";
import TokenBlacklist from "../models/tokenBlacklist.js";
import User from "../models/user.js";
import { sendEmail } from "../utils/sendEmail.js";

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// Generate Refresh Token
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "30d",
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access Public
export const register = async (req, res) => {
  try {
    // Cho phép đăng ký với role owner
    const { fullName, email, password, phone, role } = req.body;
    const userRole = role === "owner" ? "owner" : "customer";

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Check if phone already exists
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this phone number",
        });
      }
    }

    // Create user
    const userData = {
      fullName,
      email,
      password,
      role: userRole,
    };

    // Only add phone if it's not null/undefined/empty
    if (phone && phone.trim() !== "") {
      userData.phone = phone;
    }

    const user = await User.create(userData);

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/auth/email-verification?token=${verificationToken}`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Email Verification - VIC Sports",
        message: `Please click the link to verify your email: ${verificationUrl}`,
      });

      res.status(201).json({
        success: true,
        message:
          "User registered successfully. Please check your email for verification.",
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
          },
        },
      });
    } catch (error) {
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: "Email could not be sent",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists and password is provided
    const user = await User.findOne({ email }).select("+password");
    if (!user || !password) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if password matches
    const isPasswordMatched = await user.matchPassword(password);
    if (!isPasswordMatched) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is active
    if (user.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Account is not active. Please contact support.",
      });
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Update user online status
    user.isOnline = true;
    user.lastSeen = new Date();
    user.lastLoginDevice = {
      userAgent: req.get("User-Agent"),
      ip: req.ip,
      location: req.get("X-Forwarded-For") || req.connection.remoteAddress,
    };
    // Xoá token xác thực email nếu đã xác thực
    if (user.isEmailVerified) {
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
    }
    await user.save();

    // Set cookie options
    const options = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    res
      .status(200)
      .cookie("token", token, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            isEmailVerified: user.isEmailVerified,
            loyaltyTier: user.loyaltyTier,
            rewardPoints: user.rewardPoints,
          },
          token,
          refreshToken,
        },
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Social Login (Google/Facebook)
// @route   POST /api/auth/social-login
// @access Public
export const socialLogin = async (req, res) => {
  try {
    const {
      email,
      name,
      fullName,
      picture,
      phone,
      role = "customer",
      dateOfBirth,
      gender,
      address,
      loyaltyTier,
      rewardPoints,
      referralCode,
      referredBy,
      referralCount,
      birthdayVoucherClaimed,
      lastBirthdayVoucherYear,
      totalBookings,
      totalSpent,
      favoriteVenues,
      favoriteSports,
      notificationSettings,
      lastLoginDevice,
    } = req.body;

    // Tự động ép kiểu email về string nếu FE truyền object
    const emailString = email;
    const userFullName = name?.trim() || fullName?.trim() || "Google User";

    let user = await User.findOne({ email: emailString });

    if (user) {
      if (user.status === "banned") {
        return res.status(403).json({
          message:
            "Your account has been banned. Please contact an administrator.",
          errorCode: "ACCOUNT_BANNED",
        });
      }
    } else {
      // Prepare user data, only include phone if it has a valid value
      const userData = {
        fullName: userFullName,
        email: emailString,
        password: null,
        avatar: picture,
        role,
        dateOfBirth,
        gender,
        address,
        loyaltyTier,
        rewardPoints,
        referralCode,
        referredBy,
        referralCount,
        birthdayVoucherClaimed,
        lastBirthdayVoucherYear,
        totalBookings,
        totalSpent,
        favoriteVenues,
        favoriteSports,
        notificationSettings,
        lastLoginDevice,
        status: "ACTIVE",
        isEmailVerified: true,
      };

      // Only add phone if it's not null/undefined/empty
      if (phone && phone.trim() !== "") {
        userData.phone = phone;
      }

      user = new User(userData);
      await user.save();
    }

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const options = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    res
      .status(200)
      .cookie("token", token, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            isEmailVerified: user.isEmailVerified,
            loyaltyTier: user.loyaltyTier,
            rewardPoints: user.rewardPoints,
          },
          token,
          refreshToken,
        },
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Email Verification
// @route   GET /api/auth/verify-email/:token
// @access Public
export const verifyEmail = async (req, res) => {
  try {
    const token = req.query.token || req.params.token;

    // Hash the token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with this token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    // Nếu đã xác thực rồi thì trả về thành công, không xác thực lại
    if (user.isEmailVerified) {
      res.set("Cache-Control", "no-store");
      return res.status(200).json({
        success: true,
        user: {
          email: user.email,
          isVerified: user.isEmailVerified,
        },
      });
    }

    // Verify user lần đầu
    user.isEmailVerified = true;
    user.status = "ACTIVE";
    await user.save();

    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      user: {
        email: user.email,
        isVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
  // Tắt cache cho response xác thực email
  res.set("Cache-Control", "no-store");
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset - VIC Sports",
        message: `Please click the link to reset your password: ${resetUrl}`,
      });

      res.status(200).json({
        success: true,
        message: "Password reset email sent",
      });
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: "Email could not be sent",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Reset Password
// @route   PUT /api/auth/reset-password/:token
// @access Public
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash the token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with this token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Change Password
// @route   PUT /api/auth/change-password
// @access Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check current password
    const isCurrentPasswordMatched = await user.matchPassword(currentPassword);
    if (!isCurrentPasswordMatched) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Logout (Single Device)
// @route   POST /api/auth/logout
// @access Private
export const logout = async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    const refreshToken =
      req.cookies.refreshToken || req.headers["x-refresh-token"];
    let userId = null;

    // Always decode token to get userId
    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.userId) userId = decoded.userId;
      } catch (e) {
        userId = null;
      }
    }
    if (!userId && refreshToken) {
      try {
        const decoded = jwt.decode(refreshToken);
        if (decoded && decoded.userId) userId = decoded.userId;
      } catch (e) {
        userId = null;
      }
    }

    // Fire-and-forget DB operations for performance
    (async () => {
      // Blacklist access token
      if (token) {
        let decoded, expiresAt, blacklistUserId;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
          expiresAt = new Date(decoded.exp * 1000);
          blacklistUserId = decoded.userId;
        } catch (jwtError) {
          expiresAt = new Date(Date.now() + 60 * 60 * 1000);
          blacklistUserId = userId || null;
        }
        TokenBlacklist.create({
          token,
          userId: blacklistUserId,
          tokenType: "ACCESS_TOKEN",
          reason: "LOGOUT",
          expiresAt,
        }).catch((err) => {
          // Silent error handling for blacklist operations
        });
      }

      // Blacklist refresh token if exists
      if (refreshToken) {
        let decoded, expiresAt, blacklistUserId;
        try {
          decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
          expiresAt = new Date(decoded.exp * 1000);
          blacklistUserId = decoded.userId;
        } catch (jwtError) {
          expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days fallback
          blacklistUserId = userId || null;
        }
        TokenBlacklist.create({
          token: refreshToken,
          userId: blacklistUserId,
          tokenType: "REFRESH_TOKEN",
          reason: "LOGOUT",
          expiresAt,
        }).catch((err) => {
          // Silent error handling for blacklist operations
        });
      }

      // Update user online status if userId found
      if (userId) {
        try {
          const user = await User.findById(userId);
          if (user) {
            user.isOnline = false;
            await user.save();
          }
        } catch (userError) {
          // Silent error handling for user update operations
        }
      }
    })();

    // Respond immediately
    res
      .status(200)
      .clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      })
      .clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      })
      .json({
        success: true,
        message: "Logged out successfully",
      });
  } catch (error) {
    res
      .status(200)
      .clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      })
      .clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      })
      .json({
        success: true,
        message: "Logged out successfully",
      });
  }
};

// @desc    Logout All Devices
// @route   POST /api/auth/logout-all
// @access Private
export const logoutAll = async (req, res) => {
  try {
    const userId = req.user.id;

    // Add all user tokens to blacklist (in real implementation, you'd track active tokens)
    await TokenBlacklist.create({
      token: "ALL_TOKENS",
      userId,
      tokenType: "ACCESS_TOKEN",
      reason: "LOGOUT_ALL",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Update user online status
    const user = await User.findById(userId);
    if (user) {
      user.isOnline = false;
      await user.save();
    }

    res.status(200).clearCookie("token").clearCookie("refreshToken").json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Refresh Token
// @route   POST /api/auth/refresh-token
// @access Public
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // Generate new tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    const options = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    res
      .status(200)
      .cookie("token", newToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          token: newToken,
          refreshToken: newRefreshToken,
        },
      });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

// @desc    Get Current User
// @route   GET /api/auth/me
// @access Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          address: user.address,
          isEmailVerified: user.isEmailVerified,
          status: user.status,
          loyaltyTier: user.loyaltyTier,
          rewardPoints: user.rewardPoints,
          totalBookings: user.totalBookings,
          totalSpent: user.totalSpent,
          referralCode: user.referralCode,
          referralCount: user.referralCount,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
          favoriteVenues: user.favoriteVenues,
          favoriteSports: user.favoriteSports,
          notificationSettings: user.notificationSettings,
          createdAt: user.createdAt,
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
