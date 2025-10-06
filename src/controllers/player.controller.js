import User from "../models/user.js";
import Chat from "../models/chat.js";
import Message from "../models/message.js";
import { asyncHandler } from "../middlewares/async.middleware.js";

// @desc    Get online players count
// @route   GET /api/v1/players/online-count
// @access  Public
export const getOnlinePlayersCount = asyncHandler(async (req, res) => {
  const onlineCount = await User.countDocuments({ isOnline: true });

  res.status(200).json({
    success: true,
    data: {
      onlineCount,
      timestamp: new Date().toISOString(),
    },
  });
});

// @desc    Get live players (online players with activity)
// @route   GET /api/v1/players/live
// @access  Public
export const getLivePlayers = asyncHandler(async (req, res) => {
  const { limit = 10, offset = 0, sport } = req.query;

  // Build query for online players
  let query = { isOnline: true, status: "ACTIVE" };
  
  // Filter by sport if provided
  if (sport) {
    query.favoriteSports = { $in: [sport] };
  }

  const players = await User.find(query)
    .select("fullName avatar isOnline lastSeen favoriteSports loyaltyTier totalBookings totalSpent")
    .sort({ lastSeen: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset));

  // Transform data for frontend
  const transformedPlayers = players.map((player) => {
    // Generate avatar initials
    const initials = player.fullName
      .split(" ")
      .map((name) => name[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    // Generate status message based on favorite sports
    const favoriteSport = player.favoriteSports?.[0] || "Sports";
    const statusMessages = {
      football: "⚽ Looking for football match",
      tennis: "🎾 Tennis doubles partner needed",
      basketball: "🏀 Basketball game available",
      badminton: "🏸 Badminton match needed",
      volleyball: "🏐 Volleyball team looking",
      swimming: "🏊 Swimming session available",
    };
    const status = statusMessages[favoriteSport.toLowerCase()] || `🏃 Looking for ${favoriteSport} match`;

    // Calculate level based on total bookings and spending
    const level = Math.floor((player.totalBookings || 0) / 10) + Math.floor((player.totalSpent || 0) / 100000) + 1;

    // Generate badges based on loyalty tier and activity
    const badges = [];
    if (player.loyaltyTier === "Gold" || player.loyaltyTier === "Diamond") {
      badges.push("PRO PLAYER");
    }
    if (player.totalBookings > 50) {
      badges.push("VR READY");
    }
    if (player.loyaltyTier === "Diamond") {
      badges.push("CHAMPION");
    }
    if (player.totalSpent > 5000000) {
      badges.push("NFT HOLDER");
    }

    // Generate gradient based on loyalty tier
    const gradients = {
      Bronze: "from-gray-500 to-gray-600",
      Silver: "from-blue-500 to-blue-600",
      Gold: "from-yellow-500 to-yellow-600",
      Diamond: "from-purple-500 to-purple-600",
    };

    return {
      id: player._id,
      name: player.fullName,
      avatar: initials,
      avatarGradient: gradients[player.loyaltyTier] || gradients.Bronze,
      status,
      level,
      badges,
      isOnline: player.isOnline,
      lastActive: player.lastSeen,
    };
  });

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      players: transformedPlayers,
      total,
      hasMore: parseInt(offset) + parseInt(limit) < total,
    },
  });
});

// @desc    Get player profile
// @route   GET /api/v1/players/:id/profile
// @access  Public
export const getPlayerProfile = asyncHandler(async (req, res) => {
  const player = await User.findById(req.params.id)
    .select("-password -emailVerificationToken -passwordResetToken")
    .populate("favoriteVenues", "name address");

  if (!player) {
    return res.status(404).json({
      success: false,
      message: "Player not found",
    });
  }

  // Calculate stats
  const level = Math.floor((player.totalBookings || 0) / 10) + Math.floor((player.totalSpent || 0) / 100000) + 1;
  const winRate = Math.random() * 0.4 + 0.6; // Mock win rate between 60-100%

  res.status(200).json({
    success: true,
    data: {
      player: {
        id: player._id,
        name: player.fullName,
        avatar: player.avatar,
        level,
        badges: player.loyaltyTier,
        stats: {
          matchesPlayed: player.totalBookings || 0,
          winRate: Math.round(winRate * 100) / 100,
          favoriteSport: player.favoriteSports?.[0] || "Sports",
          totalSpent: player.totalSpent || 0,
          loyaltyTier: player.loyaltyTier,
        },
        isOnline: player.isOnline,
        lastSeen: player.lastSeen,
        favoriteVenues: player.favoriteVenues,
      },
    },
  });
});

// @desc    Send message to player
// @route   POST /api/v1/players/:id/message
// @access  Private
export const sendMessageToPlayer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message, type = "text" } = req.body;
  const senderId = req.user.id;

  if (!message) {
    return res.status(400).json({
      success: false,
      message: "Message content is required",
    });
  }

  // Check if target player exists
  const targetPlayer = await User.findById(id);
  if (!targetPlayer) {
    return res.status(404).json({
      success: false,
      message: "Player not found",
    });
  }

  // Check if sender is blocked by target player
  if (targetPlayer.blockedUsers.includes(senderId)) {
    return res.status(403).json({
      success: false,
      message: "You cannot send messages to this player",
    });
  }

  // Find or create direct chat
  const chat = await Chat.findOrCreateDirectChat(senderId, id);

  // Create message
  const newMessage = await Message.create({
    chatId: chat._id,
    senderId,
    content: message,
    type,
  });

  // Update chat last message
  await Chat.findByIdAndUpdate(chat._id, {
    lastMessage: {
      senderId,
      content: message,
      type,
      sentAt: new Date(),
    },
  });

  res.status(201).json({
    success: true,
    message: "Message sent successfully",
    data: {
      messageId: newMessage._id,
      status: "sent",
      timestamp: newMessage.sentAt,
    },
  });
});

// @desc    Search players
// @route   GET /api/v1/players/search
// @access  Public
export const searchPlayers = asyncHandler(async (req, res) => {
  const { q, sport, level, tier, limit = 20, offset = 0 } = req.query;

  // Build search query
  let query = { status: "ACTIVE" };

  // Text search
  if (q) {
    query.$or = [
      { fullName: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ];
  }

  // Filter by sport
  if (sport) {
    query.favoriteSports = { $in: [sport] };
  }

  // Filter by loyalty tier
  if (tier) {
    query.loyaltyTier = tier;
  }

  const players = await User.find(query)
    .select("fullName avatar isOnline lastSeen favoriteSports loyaltyTier totalBookings totalSpent")
    .sort({ lastSeen: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset));

  // Transform data similar to getLivePlayers
  const transformedPlayers = players.map((player) => {
    const initials = player.fullName
      .split(" ")
      .map((name) => name[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const favoriteSport = player.favoriteSports?.[0] || "Sports";
    const statusMessages = {
      football: "⚽ Looking for football match",
      tennis: "🎾 Tennis doubles partner needed",
      basketball: "🏀 Basketball game available",
      badminton: "🏸 Badminton match needed",
      volleyball: "🏐 Volleyball team looking",
      swimming: "🏊 Swimming session available",
    };
    const status = statusMessages[favoriteSport.toLowerCase()] || `🏃 Looking for ${favoriteSport} match`;

    const playerLevel = Math.floor((player.totalBookings || 0) / 10) + Math.floor((player.totalSpent || 0) / 100000) + 1;

    // Filter by level if specified
    if (level && Math.abs(playerLevel - parseInt(level)) > 5) {
      return null;
    }

    const badges = [];
    if (player.loyaltyTier === "Gold" || player.loyaltyTier === "Diamond") {
      badges.push("PRO PLAYER");
    }
    if (player.totalBookings > 50) {
      badges.push("VR READY");
    }
    if (player.loyaltyTier === "Diamond") {
      badges.push("CHAMPION");
    }
    if (player.totalSpent > 5000000) {
      badges.push("NFT HOLDER");
    }

    const gradients = {
      Bronze: "from-gray-500 to-gray-600",
      Silver: "from-blue-500 to-blue-600",
      Gold: "from-yellow-500 to-yellow-600",
      Diamond: "from-purple-500 to-purple-600",
    };

    return {
      id: player._id,
      name: player.fullName,
      avatar: initials,
      avatarGradient: gradients[player.loyaltyTier] || gradients.Bronze,
      status,
      level: playerLevel,
      badges,
      isOnline: player.isOnline,
      lastActive: player.lastSeen,
    };
  }).filter(Boolean); // Remove null entries

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      players: transformedPlayers,
      total,
      hasMore: parseInt(offset) + parseInt(limit) < total,
    },
  });
});

// @desc    Get player statistics
// @route   GET /api/v1/players/stats
// @access  Public
export const getPlayerStats = asyncHandler(async (req, res) => {
  const totalPlayers = await User.countDocuments({ status: "ACTIVE" });
  const onlinePlayers = await User.countDocuments({ isOnline: true, status: "ACTIVE" });
  
  // Get players by loyalty tier
  const tierStats = await User.aggregate([
    { $match: { status: "ACTIVE" } },
    { $group: { _id: "$loyaltyTier", count: { $sum: 1 } } },
  ]);

  // Get players by favorite sports
  const sportStats = await User.aggregate([
    { $match: { status: "ACTIVE", favoriteSports: { $exists: true, $ne: [] } } },
    { $unwind: "$favoriteSports" },
    { $group: { _id: "$favoriteSports", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalPlayers,
      onlinePlayers,
      tierDistribution: tierStats,
      popularSports: sportStats,
    },
  });
});

// @desc    Update player status
// @route   PUT /api/v1/players/status
// @access  Private
export const updatePlayerStatus = asyncHandler(async (req, res) => {
  const { isOnline } = req.body;
  const userId = req.user.id;

  const user = await User.findByIdAndUpdate(
    userId,
    { 
      isOnline: isOnline !== undefined ? isOnline : true,
      lastSeen: new Date(),
    },
    { new: true }
  );

  res.status(200).json({
    success: true,
    message: "Status updated successfully",
    data: {
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
    },
  });
});
