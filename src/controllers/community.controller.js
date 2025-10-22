import User from "../models/user.js";
import Tournament from "../models/tournament.js";
import TournamentRegistration from "../models/tournamentRegistration.js";
import Community from "../models/community.js";
import { asyncHandler } from "../middlewares/async.middleware.js";

// @desc    Get community statistics
// @route   GET /api/v1/community/stats
// @access  Public
export const getCommunityStats = asyncHandler(async (req, res) => {
  // Get basic counts
  const totalPlayers = await User.countDocuments({ status: "ACTIVE" });
  const onlinePlayers = await User.countDocuments({
    isOnline: true,
    status: "ACTIVE",
  });
  const activeTournaments = await Tournament.countDocuments({
    status: { $in: ["ongoing", "registration_open"] },
  });

  // Get total matches (using totalBookings as proxy)
  const totalMatches = await User.aggregate([
    { $match: { status: "ACTIVE" } },
    { $group: { _id: null, total: { $sum: "$totalBookings" } } },
  ]);

  // Get total prize pool
  const totalPrizePool = await Tournament.aggregate([
    { $match: { status: { $in: ["ongoing", "registration_open"] } } },
    { $group: { _id: null, total: { $sum: "$prizePool" } } },
  ]);

  // Get players by tier
  const tierStats = await User.aggregate([
    { $match: { status: "ACTIVE" } },
    { $group: { _id: "$loyaltyTier", count: { $sum: 1 } } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalPlayers,
      onlinePlayers,
      activeTournaments,
      totalMatches: totalMatches[0]?.total || 0,
      totalPrizePool: totalPrizePool[0]?.total || 0,
      tierDistribution: tierStats,
    },
  });
});

// @desc    Get available badges
// @route   GET /api/v1/community/badges
// @access  Public
export const getBadges = asyncHandler(async (req, res) => {
  const badges = [
    {
      id: "pro_player",
      name: "PRO PLAYER",
      description: "Professional level player",
      color: "blue",
      requirements: "Gold or Diamond tier",
      icon: "🏆",
    },
    {
      id: "vr_ready",
      name: "VR READY",
      description: "VR equipment available",
      color: "green",
      requirements: "50+ matches played",
      icon: "🥽",
    },
    {
      id: "coach",
      name: "COACH",
      description: "Certified sports coach",
      color: "purple",
      requirements: "Coach role",
      icon: "👨‍🏫",
    },
    {
      id: "ai_trained",
      name: "AI TRAINED",
      description: "AI training completed",
      color: "orange",
      requirements: "AI training program",
      icon: "🤖",
    },
    {
      id: "champion",
      name: "CHAMPION",
      description: "Tournament champion",
      color: "gold",
      requirements: "Diamond tier",
      icon: "👑",
    },
    {
      id: "nft_holder",
      name: "NFT HOLDER",
      description: "NFT collector",
      color: "rainbow",
      requirements: "5M+ VND spent",
      icon: "🎨",
    },
    {
      id: "early_adopter",
      name: "EARLY ADOPTER",
      description: "Early platform user",
      color: "silver",
      requirements: "Joined in first month",
      icon: "🚀",
    },
    {
      id: "social_butterfly",
      name: "SOCIAL BUTTERFLY",
      description: "Active community member",
      color: "pink",
      requirements: "50+ friends",
      icon: "🦋",
    },
  ];

  res.status(200).json({
    success: true,
    data: {
      badges,
    },
  });
});

// @desc    Get popular sports
// @route   GET /api/v1/community/popular-sports
// @access  Public
export const getPopularSports = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  // Get sports popularity from user preferences
  const sportStats = await User.aggregate([
    {
      $match: { status: "ACTIVE", favoriteSports: { $exists: true, $ne: [] } },
    },
    { $unwind: "$favoriteSports" },
    { $group: { _id: "$favoriteSports", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: parseInt(limit) },
  ]);

  // Get sports from tournaments
  const tournamentSports = await Tournament.aggregate([
    { $match: { status: { $in: ["ongoing", "registration_open"] } } },
    { $group: { _id: "$sportType", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Combine and format data
  const sports = sportStats.map((sport) => ({
    name: sport._id,
    playerCount: sport.count,
    tournamentCount:
      tournamentSports.find((t) => t._id === sport._id)?.count || 0,
    popularity: sport.count,
  }));

  res.status(200).json({
    success: true,
    data: {
      sports,
    },
  });
});

// @desc    Get recent community activity
// @route   GET /api/v1/community/recent-activity
// @access  Public
export const getRecentActivity = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  // Get recent tournament registrations
  const recentRegistrations = await TournamentRegistration.find({
    status: "approved",
  })
    .populate("participantId", "fullName avatar")
    .populate("tournamentId", "name sportType")
    .sort({ registeredAt: -1 })
    .limit(parseInt(limit) / 2);

  // Get recent tournaments
  const recentTournaments = await Tournament.find({
    status: { $in: ["ongoing", "registration_open"] },
  })
    .populate("organizerId", "fullName avatar")
    .populate("venueId", "name")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) / 2);

  // Format activity feed
  const activities = [];

  // Add tournament registrations
  recentRegistrations.forEach((registration) => {
    activities.push({
      type: "registration",
      user: registration.participantId,
      tournament: registration.tournamentId,
      timestamp: registration.registeredAt,
      message: `${registration.participantId.fullName} joined ${registration.tournamentId.name}`,
    });
  });

  // Add new tournaments
  recentTournaments.forEach((tournament) => {
    activities.push({
      type: "tournament_created",
      user: tournament.organizerId,
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        sportType: tournament.sportType,
      },
      venue: tournament.venueId,
      timestamp: tournament.createdAt,
      message: `${tournament.organizerId.fullName} created ${tournament.name}`,
    });
  });

  // Sort by timestamp and limit
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  activities.splice(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      activities,
    },
  });
});

// @desc    Create a Community Post
// @route   POST /api/v1/community/posts
// @access  Private
export const createCommunityPost = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    sport,
    court,
    location,
    date,
    timeSlot,
    maxParticipants,
    images,
    media,
  } = req.body;

  const communityPost = await Community.create({
    title,
    description,
    sport,
    court,
    location,
    date,
    timeSlot,
    maxParticipants,
    images,
    media,
    user: req.user.id,
    // Ensure the post creator is included as a participant
    participants: [req.user.id],
    currentParticipants: 1,
  });

  res.status(201).json({
    success: true,
    message: "Post created successfully",
    data: communityPost,
  });
});

// @desc    Get All Community Posts
// @route   GET /api/community
// @access  Public
export const getAllCommunityPosts = asyncHandler(async (req, res) => {
  const { status, date } = req.query;

  const query = {};
  if (status) query.status = status;
  if (date) query.date = date;

  const communityPosts = await Community.find(query)
    .populate("user", "fullName avatar") // Include avatar
    .populate("court", "name");

  res.status(200).json({
    success: true,
    data: communityPosts,
  });
});

// @desc    Join a Community Post
// @route   POST /api/community/:id/join
// @access  Private
export const joinCommunityPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  // Debugging logs
  console.log("Request Params:", req.params);
  console.log("Request Body:", req.body);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  const communityPost = await Community.findById(id);

  if (!communityPost) {
    return res.status(404).json({
      success: false,
      message: "Community post not found",
    });
  }

  if (communityPost.participants.length >= communityPost.maxParticipants) {
    return res.status(400).json({
      success: false,
      message: "Community post is full",
    });
  }

  // Check if the user is already a participant
  if (communityPost.participants.includes(userId)) {
    return res.status(400).json({
      success: false,
      message: "User is already a participant",
    });
  }

  communityPost.participants.push(userId);
  // Ensure owner remains a participant
  if (!communityPost.participants.includes(communityPost.user.toString())) {
    communityPost.participants.push(communityPost.user.toString());
  }
  // Sync currentParticipants with participants.length if it's larger
  communityPost.currentParticipants = Math.max(
    communityPost.currentParticipants || 0,
    communityPost.participants.length
  );

  // Auto-close when full
  if (communityPost.currentParticipants >= communityPost.maxParticipants) {
    communityPost.status = "closed";
  }

  await communityPost.save();

  res.status(200).json({
    success: true,
    message: "Successfully joined the community post.",
    data: communityPost,
  });
});

// @desc    Cancel a Community Post
// @route   PATCH /api/community/:id/cancel
// @access  Private
export const cancelCommunityPost = asyncHandler(async (req, res) => {
  const communityPost = await Community.findById(req.params.id);

  if (!communityPost) {
    return res
      .status(404)
      .json({ success: false, message: "Community post not found" });
  }

  if (communityPost.user.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ success: false, message: "Not authorized to cancel this post" });
  }

  communityPost.status = "cancelled";
  await communityPost.save();

  res.status(200).json({
    success: true,
    message: "Community post cancelled successfully.",
    data: communityPost,
  });
});

// @desc    Close a Community Post
// @route   PATCH /api/community/:id/close
// @access  Private
export const closeCommunityPost = asyncHandler(async (req, res) => {
  const communityPost = await Community.findById(req.params.id);
  console.log("Request Params:", req.params.id);
  if (!communityPost) {
    return res
      .status(404)
      .json({ success: false, message: "Community post not found" });
  }

  if (communityPost.user.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ success: false, message: "Not authorized to close this post" });
  }

  communityPost.status = "closed";
  await communityPost.save();

  res.status(200).json({
    success: true,
    message: "Community post closed successfully.",
    data: communityPost,
  });
});

// @desc    Get a Single Community Post
// @route   GET /api/community/:id
// @access  Public
export const getSingleCommunityPost = asyncHandler(async (req, res) => {
  const communityPost = await Community.findById(req.params.id)
    .populate("user", "fullName avatar") // Include avatar
    .populate("court", "name");

  if (!communityPost) {
    return res
      .status(404)
      .json({ success: false, message: "Community post not found" });
  }

  res.status(200).json({
    success: true,
    data: communityPost,
  });
});

// @desc    Update Community Post (owner only)
// @route   PUT /api/v1/community/:id
// @access  Private
export const updateCommunityPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, status } = req.body;

  // Allowed fields: title, description, status
  const communityPost = await Community.findById(id);

  if (!communityPost) {
    return res
      .status(404)
      .json({ success: false, message: "Community post not found" });
  }

  if (communityPost.user.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ success: false, message: "Not authorized to update this post" });
  }

  if (typeof title !== "undefined") communityPost.title = title;
  if (typeof description !== "undefined")
    communityPost.description = description;
  if (typeof status !== "undefined") communityPost.status = status;

  // Validate currentParticipants if provided in update body
  if (typeof req.body.currentParticipants !== "undefined") {
    const provided = req.body.currentParticipants;
    const registeredCount = communityPost.participants.length;
    if (provided < registeredCount) {
      return res.status(400).json({
        success: false,
        message: `currentParticipants cannot be less than ${registeredCount} registered participants`,
      });
    }
    communityPost.currentParticipants = provided;
  }

  // Ensure currentParticipants is at least participants.length
  communityPost.currentParticipants = Math.max(
    communityPost.currentParticipants || 0,
    communityPost.participants.length
  );

  // Auto-close when full
  if (communityPost.currentParticipants >= communityPost.maxParticipants) {
    communityPost.status = "closed";
  }

  await communityPost.save();

  res.status(200).json({
    success: true,
    message: "Post updated successfully",
    data: communityPost,
  });
});

// @desc    Toggle Like on a Community Post
// @route   POST /api/v1/community/:id/like
// @access  Private
export const toggleLikeCommunityPost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the community post
  const communityPost = await Community.findById(id);

  if (!communityPost) {
    return res.status(404).json({
      success: false,
      message: "Community post not found",
    });
  }

  // Check if the user already liked the post
  const userIndex = communityPost.likes.indexOf(req.user.id);

  if (userIndex === -1) {
    // User has not liked yet, add like
    communityPost.likes.push(req.user.id);
  } else {
    // User has already liked, remove like
    communityPost.likes.splice(userIndex, 1);
  }

  await communityPost.save();

  res.status(200).json({
    success: true,
    message: "Like toggled successfully",
    data: communityPost,
  });
});

// @desc    Accept a Community Post
// @route   PATCH /api/v1/community/:id/accept
// @access  Private
export const acceptCommunityPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  // Find the community post
  const communityPost = await Community.findById(id);

  if (!communityPost) {
    return res.status(404).json({
      success: false,
      message: "Community post not found",
    });
  }

  // Check if the user is authorized to accept participants
  if (communityPost.user.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to accept participants for this post",
    });
  }

  // Validate userId
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  // Check if the user is already a participant
  if (communityPost.participants.includes(userId)) {
    return res.status(400).json({
      success: false,
      message: "User is already a participant",
    });
  }

  // Add the user to the participants array
  communityPost.participants.push(userId);
  // Ensure owner remains a participant
  if (!communityPost.participants.includes(communityPost.user.toString())) {
    communityPost.participants.push(communityPost.user.toString());
  }
  await communityPost.save();

  res.status(200).json({
    success: true,
    message: "User accepted successfully",
    data: communityPost,
  });
});

// @desc    Reject a Community Post Participant
// @route   PATCH /api/v1/community/:id/reject
// @access  Private
export const rejectCommunityPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  // Find the community post
  const communityPost = await Community.findById(id);

  if (!communityPost) {
    return res.status(404).json({
      success: false,
      message: "Community post not found",
    });
  }

  // Check if the user is authorized to reject participants
  if (communityPost.user.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to reject participants for this post",
    });
  }

  // Validate userId
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  // Add user to rejectedUsers array if not already present
  if (!communityPost.rejectedUsers.includes(userId)) {
    communityPost.rejectedUsers.push(userId);
    // Ensure owner remains a participant before saving
    if (!communityPost.participants.includes(communityPost.user.toString())) {
      communityPost.participants.push(communityPost.user.toString());
    }
    await communityPost.save();
  }

  res.status(200).json({
    success: true,
    message: "User rejected successfully",
  });
});

// @desc    Check Rejection Status
// @route   GET /api/v1/community/:postId/request-status/:userId
// @access  Private
export const checkRejectionStatus = asyncHandler(async (req, res) => {
  const { postId, userId } = req.params;

  // Find the community post
  const communityPost = await Community.findById(postId);

  if (!communityPost) {
    return res.status(404).json({
      success: false,
      message: "Community post not found",
    });
  }

  // Check if the user is a participant
  const isParticipant = communityPost.participants.includes(userId);

  // Check if the user is rejected
  const isRejected = communityPost.rejectedUsers?.includes(userId) || false;

  res.status(200).json({
    success: true,
    data: {
      isParticipant,
      isRejected,
    },
  });
});
