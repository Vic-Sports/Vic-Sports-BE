import User from "../models/user.js";
import Tournament from "../models/tournament.js";
import TournamentRegistration from "../models/tournamentRegistration.js";
import { asyncHandler } from "../middlewares/async.middleware.js";

// @desc    Get community statistics
// @route   GET /api/v1/community/stats
// @access  Public
export const getCommunityStats = asyncHandler(async (req, res) => {
  // Get basic counts
  const totalPlayers = await User.countDocuments({ status: "ACTIVE" });
  const onlinePlayers = await User.countDocuments({ isOnline: true, status: "ACTIVE" });
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
    { $match: { status: "ACTIVE", favoriteSports: { $exists: true, $ne: [] } } },
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
    tournamentCount: tournamentSports.find((t) => t._id === sport._id)?.count || 0,
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
  const recentRegistrations = await TournamentRegistration.find({ status: "approved" })
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
