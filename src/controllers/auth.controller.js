import User from "../models/user.js";
import TokenBlacklist from "../models/tokenBlacklist.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
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
    const { fullName, email, password, phone, role = "customer" } = req.body;

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
    const user = await User.create({
      fullName,
      email,
      password,
      phone,
      role,
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    
    try {
      await sendEmail({
        email: user.email,
        subject: "Email Verification - VIC Sports",
        message: `Please click the link to verify your email: ${verificationUrl}`,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully. Please check your email for verification.",
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
    await user.save();

    // Set cookie options
    const options = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    res.status(200)
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
    const { provider, socialId, email, name, picture } = req.body;

    // Check if user exists with social login
    const user = await User.findOne({
      [`socialLogin.${provider}.id`]: socialId,
    });

    if (user) {
      // User exists, generate tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Update user online status
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();

      const options = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      };

      return res.status(200)
        .cookie("token", token, options)
        .cookie("refreshToken", refreshToken, options)
        .json({
          success: true,
          message: "Social login successful",
          data: {
            user: {
              id: user._id,
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              avatar: user.avatar,
              isEmailVerified: user.isEmailVerified,
            },
            token,
            refreshToken,
          },
        });
    }

    // Check if user exists with email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Link social account to existing user
      existingUser.socialLogin[provider] = {
        id: socialId,
        email,
        name,
        picture,
      };
      existingUser.isEmailVerified = true; // Social login implies email verification
      existingUser.isOnline = true;
      existingUser.lastSeen = new Date();
      await existingUser.save();

      const token = generateToken(existingUser._id);
      const refreshToken = generateRefreshToken(existingUser._id);

      const options = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      };

      return res.status(200)
        .cookie("token", token, options)
        .cookie("refreshToken", refreshToken, options)
        .json({
          success: true,
          message: "Social account linked successfully",
          data: {
            user: {
              id: existingUser._id,
              fullName: existingUser.fullName,
              email: existingUser.email,
              role: existingUser.role,
              avatar: existingUser.avatar,
              isEmailVerified: existingUser.isEmailVerified,
            },
            token,
            refreshToken,
          },
        });
    }

    // Create new user
    const newUser = await User.create({
      fullName: name,
      email,
      avatar: picture,
      socialLogin: {
        [provider]: {
          id: socialId,
          email,
          name,
          picture,
        },
      },
      isEmailVerified: true,
      status: "ACTIVE",
    });

    const token = generateToken(newUser._id);
    const refreshToken = generateRefreshToken(newUser._id);

    const options = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    res.status(201)
      .cookie("token", token, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        success: true,
        message: "Account created successfully",
        data: {
          user: {
            id: newUser._id,
            fullName: newUser.fullName,
            email: newUser.email,
            role: newUser.role,
            avatar: newUser.avatar,
            isEmailVerified: newUser.isEmailVerified,
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
    const { token } = req.params;

    // Hash the token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with this token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    // Verify user
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.status = "ACTIVE";
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
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
    const userId = req.user.id;

    if (token) {
      // Add token to blacklist
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await TokenBlacklist.create({
        token,
        userId: decoded.userId,
        tokenType: "ACCESS_TOKEN",
        reason: "LOGOUT",
        expiresAt: new Date(decoded.exp * 1000),
      });
    }

    // Update user online status
    const user = await User.findById(userId);
    if (user) {
      user.isOnline = false;
      await user.save();
    }

    res.status(200)
      .clearCookie("token")
      .clearCookie("refreshToken")
      .json({
        success: true,
        message: "Logged out successfully",
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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

    res.status(200)
      .clearCookie("token")
      .clearCookie("refreshToken")
      .json({
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

    res.status(200)
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
    const user = await User.findById(req.user?.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

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