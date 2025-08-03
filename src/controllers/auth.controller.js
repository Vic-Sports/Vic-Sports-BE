import User from '../models/user.js';
import TokenBlacklist from '../models/tokenBlacklist.js';
import { asyncHandler } from '../middlewares/async.middleware.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import jwt from 'jsonwebtoken';
import { sendTemplatedEmail } from '../utils/sendEmail.js';
import logger from '../utils/logger.js';
import { generateToken } from '../utils/jwt.js';

const otpStore = new Map();

// ==================== Register ==================== //
export const register = async (req, res, next) => {
  try {
    const { fullName, username, email, password, phone, address } = req.body;

    // Check required fields
    if (!fullName || !username || !email || !password || !phone || !address) {
      return next(
        new ErrorResponse(
          'Please provide full name, username, email, password, phone and address',
          400
        )
      );
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return next(new ErrorResponse('User already exists', 400));
    }

    // Generate verification token
    const verificationToken = generateToken({ email }, process.env.JWT_VERIFY_EXPIRES_IN || '1h');

    // Create user
    const user = await User.create({
      fullName,
      username,
      email,
      password,
      phone,
      address,
      role: 'customer',
      isVerified: false,
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + 3600000), // 1 hour
    });

    // Send verification email
    await sendTemplatedEmail({
      email: user.email,
      templateType: 'VERIFICATION',
      templateData: {
        name: user.fullName,
        verificationLink: `${
          process.env.FRONTEND_URL || 'http://localhost:5000'
        }/verify-email?token=${verificationToken}`,
      },
    });

    // Generate tokens
    const accessToken = generateToken({ id: user._id }, process.env.JWT_EXPIRES_IN || '1d');
    const refreshToken = generateToken(
      { id: user._id },
      process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    );

    // Remove sensitive data from response
    user.password = undefined;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;

    logger.info('User registered successfully', { userId: user._id });

    res.status(201).json({
      success: true,
      data: {
        user,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Error in register controller', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// ==================== Login ==================== // 
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new ErrorResponse('Please provide email and password', 400));
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(
        new ErrorResponse(
          'Email not found. Please check your email or register a new account.',
          401
        )
      );
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return next(
        new ErrorResponse(
          "Incorrect password. Please try again or use 'Forgot Password' if you don't remember.",
          401
        )
      );
    }

    if (!user.isVerified) {
      return next(
        new ErrorResponse(
          'Please verify your email before logging in. Check your inbox for the verification link.',
          401
        )
      );
    }

    if (!user.status) {
      return next(
        new ErrorResponse(
          'Your account has been deactivated. Please contact support for assistance.',
          401
        )
      );
    }

    const accessToken = generateToken({ id: user._id }, process.env.JWT_EXPIRES_IN || '1d');
    const refreshToken = generateToken(
      { id: user._id },
      process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    );

    user.password = undefined;

    logger.info('User logged in successfully', { userId: user._id });

    res.status(200).json({
      success: true,
      data: {
        user,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Error in login controller', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// ==================== Account ==================== //
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    logger.info('User profile retrieved successfully', { userId: user._id });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Error in getMe controller', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// ==================== Update Profile ==================== //
export const updateProfile = async (req, res, next) => {
  try {
    const { fullName, username, email, phone, address, dateOfBirth, gender, aboutMe } = req.body;

    // Build update object
    const updateFields = {};
    if (fullName) updateFields.fullName = fullName;
    if (username) updateFields.username = username;
    if (email) updateFields.email = email;
    if (phone) updateFields.phone = phone;
    if (address) updateFields.address = address;
    if (dateOfBirth) updateFields.dateOfBirth = dateOfBirth;
    if (gender) updateFields.gender = gender;
    if (aboutMe) updateFields.aboutMe = aboutMe;

    // Handle avatar file if present
    if (req.file) {
      updateFields.avatar = req.file.path;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    logger.info('User profile updated successfully', { userId: user._id });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Error in updateProfile controller', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// ==================== Change Paswowrd ==================== //
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    logger.info('Change password request', req.body);

    if (!currentPassword || !newPassword) {
      return next(new ErrorResponse('Please provide current password and new password', 400));
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return next(new ErrorResponse('Current password is incorrect', 401));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info('User password changed successfully', { userId: user._id });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Error in changePassword controller', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// ==================== Forgot Password ==================== //
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new ErrorResponse('Please provide an email', 400));
    }

    const user = await User.findOne({ email });

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Generate reset token
    const resetToken = generateToken({ id: user._id }, process.env.JWT_RESET_EXPIRES_IN || '1h');

    // Send reset email
    await sendTemplatedEmail({
      email: user.email,
      templateType: 'PASSWORD_RESET',
      templateData: {
        name: user.username,
        resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
      },
    });

    logger.info('Password reset email sent successfully', { userId: user._id });

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    logger.error('Error in forgotPassword controller', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// ==================== Reset Password ==================== //
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return next(new ErrorResponse('Please provide token and new password', 400));
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    console.log(user);
    console.log(newPassword);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info('Password reset successfully', { userId: user._id });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    logger.error('Error in resetPassword controller', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// ==================== Logout ==================== //
export const logout = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    // Add token to blacklist
    await TokenBlacklist.create({
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});

// ==================== Verify Email ==================== //
export const verifyEmail = async (req, res, next) => {
  try {
    // Get token from query params
    const token = req.query.token;

    if (!token) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/email-verification-failed?error=Verification token is required`
      );
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      email: decoded.email,
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/email-verification-failed?error=Invalid or expired verification token`
      );
    }

    // Update user
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    logger.info('Email verified successfully', { userId: user._id });

    // Redirect to success page
    return res.redirect(
      `${process.env.FRONTEND_URL}/email-verified?email=${encodeURIComponent(user.email)}`
    );
  } catch (error) {
    logger.error('Error in verifyEmail controller', {
      error: error.message,
      stack: error.stack,
    });
    return res.redirect(
      `${
        process.env.FRONTEND_URL
      }/email-verification-failed?error=${encodeURIComponent(error.message)}`
    );
  }
};

// ==================== Resend Verification ==================== //
export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new ErrorResponse('Email is required', 400));
    }

    const user = await User.findOne({ email });

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    if (user.isVerified) {
      return next(new ErrorResponse('Email is already verified', 400));
    }

    // Generate new verification token
    const verificationToken = generateToken(
      { email: user.email },
      process.env.JWT_VERIFY_EXPIRES_IN || '1h'
    );

    // Update user
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Send verification email
    await sendTemplatedEmail({
      email: user.email,
      templateType: 'VERIFICATION',
      templateData: {
        name: user.username,
        verificationLink: `${
          process.env.FRONTEND_URL || 'http://localhost:5000'
        }/verify-email?token=${verificationToken}`,
      },
    });

    logger.info('Verification email resent successfully', { userId: user._id });

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    logger.error('Error in resendVerification controller', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// ==================== Refresh Token ==================== //
export const refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new ErrorResponse('Refresh token is required', 400));
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });

    res.status(200).json({
      success: true,
      token,
    });
  } catch (err) {
    return next(new ErrorResponse('Invalid refresh token', 401));
  }
});
