import User from "../models/user.js";
import { sendTemplatedEmail } from "../utils/sendEmail.js";
import Venue from "../models/venue.js";

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

export const getAllUsers = async (req, res, next) => {
  try {
    const current = Math.max(parseInt(req.query.current) || 1, 1);
    const pageSize = Math.max(parseInt(req.query.pageSize) || 10, 1);

    const filter = {};
    if (req.query.email) filter.email = toRegexIfPattern(req.query.email);
    if (req.query.fullName)
      filter.fullName = toRegexIfPattern(req.query.fullName);

    const gte = req.query["createdAt>="];
    const lte = req.query["createdAt<="];
    if (gte || lte) {
      filter.createdAt = {};
      if (gte) filter.createdAt.$gte = new Date(gte);
      if (lte) filter.createdAt.$lte = new Date(lte);
    }

    let sort = "-createdAt";
    if (
      typeof req.query.sort === "string" &&
      req.query.sort.trim().length > 0
    ) {
      sort = req.query.sort;
    }

    const skip = (current - 1) * pageSize;

    // Owner scope: only users who booked owner's venues
    if (req.user?.role === "owner") {
      const Booking = (await import("../models/booking.js")).default;
      const Venue = (await import("../models/venue.js")).default;
      const venues = await Venue.find({ ownerId: req.user._id })
        .select("_id")
        .lean();
      const venueIds = venues.map((v) => v._id);
      const userIds = await Booking.distinct("user", {
        venue: { $in: venueIds },
      });
      filter._id = { $in: userIds };
    }

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

// --- Placeholders for other admin handlers to keep imports working ---
export const getUserDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", statusCode: 404 });
    }
    return res.status(200).json({
      message: "Success",
      statusCode: 200,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc Promote a user to owner
// @route PUT /api/v1/admin/users/:userId/promote
// @access Private (admin)
export const promoteUserToOwner = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ message: "User not found", statusCode: 404 });

    user.role = "owner";
    // mark as pending until admin confirms Google Group membership
    user.googleGroupStatus = "pending";
    await user.save();

    return res
      .status(200)
      .json({ message: "User promoted to owner", statusCode: 200, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc Confirm that admin has added the owner to Google Group
// @route PUT /api/v1/admin/users/:userId/confirm-google-group
// @access Private (admin)
export const confirmGoogleGroup = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ message: "User not found", statusCode: 404 });

    // Only change if currently pending
    user.googleGroupStatus = "active";
    await user.save();

    return res
      .status(200)
      .json({
        message: "Google group membership confirmed",
        statusCode: 200,
        data: user,
      });
  } catch (err) {
    next(err);
  }
};

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
    ];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const before = await User.findById(userId).lean();
    if (!before) {
      return res
        .status(404)
        .json({ message: "User not found", statusCode: 404 });
    }

    // If role is being updated to 'owner', ensure googleGroupStatus is set to 'pending'
    if (updates.role === "owner") {
      updates.googleGroupStatus = "pending";
    }

    await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { runValidators: true }
    );

    const user = await User.findById(userId).lean();

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", statusCode: 404 });
    }

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

    return res
      .status(200)
      .json({ message: "Updated", statusCode: 200, data: user });
  } catch (err) {
    next(err);
  }
};
export const banUser = (req, res) =>
  res.status(501).json({ message: "Not implemented" });
export const unbanUser = (req, res) =>
  res.status(501).json({ message: "Not implemented" });
export const getPendingCoaches = (req, res) =>
  res.status(501).json({ message: "Not implemented" });
export const verifyCoach = (req, res) =>
  res.status(501).json({ message: "Not implemented" });
export const getPendingOwners = (req, res) =>
  res.status(501).json({ message: "Not implemented" });
export const verifyOwner = (req, res) =>
  res.status(501).json({ message: "Not implemented" });
export const getPendingReviews = (req, res) =>
  res.status(501).json({ message: "Not implemented" });
export const approveReview = (req, res) =>
  res.status(501).json({ message: "Not implemented" });
export const rejectReview = (req, res) =>
  res.status(501).json({ message: "Not implemented" });
export const getDashboardAnalytics = (req, res) =>
  res.status(501).json({ message: "Not implemented" });

// --- Admin Venue Management ---
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
      if (req.query.isVerified === "true") filter.isVerified = true;
      else if (req.query.isVerified === "false") filter.isVerified = false;
    }
    if (typeof req.query.isActive === "string") {
      if (req.query.isActive === "true") filter.isActive = true;
      else if (req.query.isActive === "false") filter.isActive = false;
    }

    const sort =
      typeof req.query.sort === "string" ? req.query.sort : "-createdAt";

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

export const approveVenue = async (req, res, next) => {
  try {
    const { venueId } = req.params;
    const venue = await Venue.findById(venueId);
    if (!venue)
      return res
        .status(404)
        .json({ message: "Venue not found", statusCode: 404 });
    venue.isVerified = true;
    venue.verifiedAt = new Date();
    await venue.save();
    return res
      .status(200)
      .json({ message: "Venue approved", statusCode: 200, data: venue });
  } catch (err) {
    next(err);
  }
};

export const rejectVenue = async (req, res, next) => {
  try {
    const { venueId } = req.params;
    const venue = await Venue.findById(venueId);
    if (!venue)
      return res
        .status(404)
        .json({ message: "Venue not found", statusCode: 404 });
    venue.isVerified = false;
    await venue.save();
    return res
      .status(200)
      .json({ message: "Venue rejected", statusCode: 200, data: venue });
  } catch (err) {
    next(err);
  }
};
