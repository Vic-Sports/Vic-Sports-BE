import User from '../models/user.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import logger from '../utils/logger.js';
import { UserService } from '../services/user.service.js';

// Get all users with pagination
export const getUsers = async (req, res) => {
  try {
    const { users, total } = await UserService.getAllUsers(req.query);
    res.json({ success: true, data: users, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all users is active
export const getUsersIsActive = async (req, res) => {
  try {
    const users = await User.find({ status: true }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single user
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create user
export const createUser = async (req, res) => {
  try {
    const user = new User(req.body);
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user profile
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password -verificationToken -verificationTokenExpires')
      .populate('role', 'name');

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // If user is not verified, only show limited information
    if (!user.isVerified) {
      return res.json({
        username: user.username,
        avatar: user.avatar,
        role: user.role,
      });
    }

    res.json(user);
  } catch (error) {
    logger.error('Error in getUserProfile', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// Update user profile
export const updateUserProfile = async (req, res, next) => {
  try {
    logger.info('Starting profile update', {
      hasFile: !!req.file,
      fileDetails: req.file
        ? {
            fieldname: req.file.fieldname,
            originalname: req.file.originalname,
            path: req.file.path,
            filename: req.file.filename,
            mimetype: req.file.mimetype,
          }
        : null,
    });

    const allowedUpdates = [
      'fullName',
      'aboutMe',
      'avatar',
      'address',
      'phone',
      'dateOfBirth',
      'gender',
    ];

    // Filter out fields that are not allowed to be updated
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    // Handle avatar upload
    if (req.file) {
      logger.info('File uploaded to Cloudinary', { path: req.file.path });
      updates.avatar = req.file.path;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -verificationToken -verificationTokenExpires');

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    logger.info('Profile updated successfully', {
      userId: user._id,
      avatar: user.avatar,
      updates,
    });

    res.json(user);
  } catch (error) {
    logger.error('Error in updateUserProfile', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
};

// Toggle user status
export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Toggle status
    user.status = !user.status;

    await user.save();

    res.json({
      message: `User has been ${user.status ? 'unbanned' : 'banned'}`,
      status: user.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get owner user
export const getOwner = async (req, res) => {
  try {
    const shopUser = await User.findOne({ role: 'owner' }).select('-password');
    if (!shopUser) {
      return res.status(404).json({ message: 'Owner not found' });
    }
    res.json(shopUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
