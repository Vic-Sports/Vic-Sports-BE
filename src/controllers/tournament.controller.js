import mongoose from "mongoose";
import { asyncHandler } from "../middlewares/async.middleware.js";
import Tournament from "../models/tournament.js";
import TournamentMatch from "../models/tournamentMatch.js";
import TournamentRegistration from "../models/tournamentRegistration.js";
import Venue from "../models/venue.js";
import { calculateTournamentStatus, updateOwnerTournamentStatuses, updateTournamentStatus } from "../utils/tournamentStatusUpdater.js";

// @desc    Get all tournaments (Public)
// @route   GET /api/v1/tournaments
// @access  Public
export const getAllTournaments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    sportType,
    venueId,
    dateFrom,
    dateTo,
    sortBy = "startDate",
    sortOrder = "desc",
  } = req.query;

  // Build query - exclude cancelled and completed tournaments
  const query = { 
    isPublic: true,
    status: { $nin: ["cancelled", "completed"] }
  };
  
  if (status) query.status = status;
  if (sportType) query.sportType = sportType;
  if (venueId) query.venueId = venueId;
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (dateFrom || dateTo) {
    query.startDate = {};
    if (dateFrom) query.startDate.$gte = new Date(dateFrom);
    if (dateTo) query.startDate.$lte = new Date(dateTo);
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  // Execute query
  const tournaments = await Tournament.find(query)
    .populate("venueId", "name address")
    .populate("organizerId", "fullName avatar")
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Tournament.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      tournaments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Get all tournaments for list page (Public)
// @route   GET /api/v1/tournaments/list-all
// @access  Public
export const getAllTournamentsList = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    search,
    status,
    sportType,
    venueId,
    dateFrom,
    dateTo,
    sortBy = "startDate",
    sortOrder = "desc",
  } = req.query;

  // Build query - exclude cancelled and completed tournaments by default
  const query = { 
    isPublic: true
  };
  
  // Handle status filter
  if (status && status !== "" && status !== "all") {
    query.status = status;
  } else if (status === "all") {
    // Show all tournaments including cancelled and completed
    // No status filter applied
  } else {
    // Default behavior: exclude cancelled and completed tournaments
    query.status = { $nin: ["cancelled", "completed"] };
  }
  if (sportType) query.sportType = sportType;
  if (venueId) query.venueId = venueId;
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (dateFrom || dateTo) {
    query.startDate = {};
    if (dateFrom) query.startDate.$gte = new Date(dateFrom);
    if (dateTo) query.startDate.$lte = new Date(dateTo);
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  // Execute query with more detailed population
  const tournaments = await Tournament.find(query)
    .populate("venueId", "name address city district")
    .populate("organizerId", "fullName avatar")
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Tournament.countDocuments(query);

  // Get available sport types for filtering
  const sportTypes = await Tournament.distinct("sportType", query);

  res.status(200).json({
    success: true,
    data: {
      tournaments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
      filters: {
        sportTypes,
        statuses: ["upcoming", "registration_open", "registration_closed", "ongoing", "completed", "cancelled"]
      }
    },
  });
});

// @desc    Get featured tournaments (Public)
// @route   GET /api/v1/tournaments/featured
// @access  Public
export const getFeaturedTournaments = asyncHandler(async (req, res) => {
  const tournaments = await Tournament.find({
    isPublic: true,
    status: { $in: ["upcoming", "registration_open"] },
  })
    .populate("venueId", "name address")
    .sort({ createdAt: -1 })
    .limit(6);

  res.status(200).json({
    success: true,
    data: tournaments,
  });
});

// @desc    Get tournament by ID (Public)
// @route   GET /api/v1/tournaments/:id
// @access  Public
export const getTournamentById = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findById(req.params.id)
    .populate("venueId", "name address contactInfo amenities images ratings")
    .populate("organizerId", "fullName email phone avatar");

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found",
    });
  }

  // Get tournament participants count and basic info
  const participants = await TournamentRegistration.find({ 
    tournamentId: req.params.id,
    status: "confirmed"
  })
    .populate("user", "fullName avatar")
    .sort({ registrationDate: -1 });

  // Get tournament matches if any
  const matches = await TournamentMatch.find({ tournamentId: req.params.id })
    .populate("player1", "fullName")
    .populate("player2", "fullName")
    .sort({ matchDate: 1 });

  // Calculate additional tournament info
  const tournamentDetail = {
    ...tournament.toObject(),
    participants: participants,
    participantsCount: participants.length,
    matches: matches,
    matchesCount: matches.length,
    isRegistrationOpen: tournament.status === "registration_open",
    canJoin: tournament.status === "registration_open" && 
             tournament.currentParticipants < tournament.maxParticipants &&
             new Date() >= new Date(tournament.registrationStartDate) &&
             new Date() <= new Date(tournament.registrationEndDate),
    daysUntilStart: Math.ceil((new Date(tournament.startDate) - new Date()) / (1000 * 60 * 60 * 24)),
    daysUntilRegistrationEnd: Math.ceil((new Date(tournament.registrationEndDate) - new Date()) / (1000 * 60 * 60 * 24))
  };

  res.status(200).json({
    success: true,
    data: tournamentDetail,
  });
});

// @desc    Join tournament (User)
// @route   POST /api/v1/tournaments/:id/join
// @access  Private (User)
export const joinTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found",
    });
  }

  if (tournament.status !== "registration_open") {
    return res.status(400).json({
      success: false,
      message: "Tournament registration is not open",
    });
  }

  if (tournament.currentParticipants >= tournament.maxParticipants) {
    return res.status(400).json({
      success: false,
      message: "Tournament is full",
    });
  }

  // Check if user already joined
  const existingRegistration = await TournamentRegistration.findOne({
    tournamentId: req.params.id,
    user: req.user.id,
  });

  if (existingRegistration) {
    return res.status(400).json({
      success: false,
      message: "You have already joined this tournament",
    });
  }

  // Create registration
  const registration = await TournamentRegistration.create({
    tournamentId: req.params.id,
    user: req.user.id,
    registrationDate: new Date(),
    status: "confirmed",
  });

  // Update tournament participant count
  tournament.currentParticipants += 1;
  await tournament.save();

  res.status(201).json({
    success: true,
    message: "Successfully joined tournament",
    data: registration,
  });
});

// @desc    Get tournament participants (Public)
// @route   GET /api/v1/tournaments/:id/participants
// @access  Public
export const getTournamentParticipants = asyncHandler(async (req, res) => {
  const participants = await TournamentRegistration.find({ tournamentId: req.params.id })
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: participants,
  });
});

// @desc    Update tournament (Admin)
// @route   PUT /api/v1/tournaments/:id
// @access  Private (Admin)
export const updateTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found",
    });
  }

  const {
    name,
    description,
    sportType,
    venueId,
    startDate,
    endDate,
    registrationStartDate,
    registrationEndDate,
    maxParticipants,
    minParticipants,
    teamSize,
    entryFee,
    prizePool,
    prizeDistribution,
    estimatedDuration,
    ageRestrictions,
    format,
    rules,
    requirements,
    requireApproval,
    allowSubstitutes,
    isActive,
    images,
  } = req.body;

  // Build update object with only provided fields
  const updateData = {};
  
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (sportType !== undefined) updateData.sportType = sportType;
  if (venueId !== undefined) updateData.venueId = venueId;
  if (startDate !== undefined) updateData.startDate = new Date(startDate);
  if (endDate !== undefined) updateData.endDate = new Date(endDate);
  if (registrationStartDate !== undefined) updateData.registrationStartDate = new Date(registrationStartDate);
  if (registrationEndDate !== undefined) updateData.registrationEndDate = new Date(registrationEndDate);
  if (maxParticipants !== undefined) updateData.maxParticipants = maxParticipants;
  if (minParticipants !== undefined) updateData.minParticipants = minParticipants;
  if (teamSize !== undefined) updateData.teamSize = teamSize;
  if (entryFee !== undefined) updateData.registrationFee = entryFee;
  if (prizePool !== undefined) updateData.prizePool = prizePool;
  if (prizeDistribution !== undefined) updateData.prizeDistribution = prizeDistribution;
  if (estimatedDuration !== undefined) updateData.estimatedDuration = estimatedDuration;
  if (ageRestrictions !== undefined) updateData.ageRestrictions = ageRestrictions;
  if (format !== undefined) updateData.tournamentType = format;
  if (rules !== undefined) {
    updateData.rules = typeof rules === 'string' ? [rules] : rules;
  }
  if (requireApproval !== undefined) updateData.requireApproval = requireApproval;
  if (allowSubstitutes !== undefined) updateData.allowSubstitutes = allowSubstitutes;
  if (isActive !== undefined) updateData.isPublic = isActive;
  if (images !== undefined) {
    updateData.gallery = images;
    updateData.bannerImage = images[0] || "";
  }

  // Check if venue exists if venueId is being updated
  if (venueId && venueId !== tournament.venueId.toString()) {
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }
  }

  // Update tournament
  const updatedTournament = await Tournament.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  )
    .populate("venueId", "name address")
    .populate("organizerId", "fullName email");

  res.status(200).json({
    success: true,
    message: "Tournament updated successfully",
    data: updatedTournament,
  });
});

// @desc    Delete tournament (Admin)
// @route   DELETE /api/v1/tournaments/:id
// @access  Private (Admin)
export const deleteTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found",
    });
  }

  await Tournament.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: "Tournament deleted successfully",
  });
});

// @desc    Get tournament statistics (Public)
// @route   GET /api/v1/tournaments/stats
// @access  Public
export const getTournamentStats = asyncHandler(async (req, res) => {
  const [
    totalTournaments,
    activeTournaments,
    upcomingTournaments,
    completedTournaments,
    sportTypeStats,
  ] = await Promise.all([
    Tournament.countDocuments({ isPublic: true }),
    Tournament.countDocuments({ 
      isPublic: true,
      status: "ongoing" 
    }),
    Tournament.countDocuments({ 
      isPublic: true,
      status: "upcoming" 
    }),
    Tournament.countDocuments({ 
      isPublic: true,
      status: "completed" 
    }),
    Tournament.aggregate([
      { $match: { isPublic: true } },
      { $group: { _id: "$sportType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalTournaments,
      activeTournaments,
      upcomingTournaments,
      completedTournaments,
      sportTypeStats: sportTypeStats.map(stat => ({
        sportType: stat._id,
        count: stat.count
      }))
    },
  });
});

// @desc    Create tournament (Admin)
// @route   POST /api/v1/tournaments
// @access  Private (Admin)
export const createTournament = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    sportType,
    venueId,
    startDate,
    endDate,
    registrationStartDate,
    registrationEndDate,
    maxParticipants,
    minParticipants,
    teamSize = 1,
    entryFee,
    prizePool,
    prizeDistribution = [],
    estimatedDuration,
    ageRestrictions,
    format,
    rules,
    requirements,
    requireApproval = false,
    allowSubstitutes = false,
    isActive = true,
    images = [],
  } = req.body;

  // Validate required fields
  if (!name || !sportType || !venueId || !startDate || !endDate || !maxParticipants || !minParticipants) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  // Check if venue exists
  const venue = await Venue.findById(venueId);
  if (!venue) {
    return res.status(404).json({
      success: false,
      message: "Venue not found",
    });
  }

  // Determine initial status based on dates
  const now = new Date();
  const regStart = new Date(registrationStartDate);
  const regEnd = new Date(registrationEndDate);
  const start = new Date(startDate);
  
  let status = "upcoming";
  if (now >= regStart && now <= regEnd) {
    status = "registration_open";
  } else if (now > regEnd && now < start) {
    status = "registration_closed";
  }

  const tournament = await Tournament.create({
    organizerId: req.user.id,
    venueId,
    name,
    description,
    sportType,
    tournamentType: format || "single_elimination",
    maxParticipants,
    minParticipants,
    teamSize,
    currentParticipants: 0,
    registrationStartDate: new Date(registrationStartDate),
    registrationEndDate: new Date(registrationEndDate),
    registrationFee: entryFee || 0,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    estimatedDuration,
    prizePool: prizePool || 0,
    prizeDistribution,
    rules: rules ? (typeof rules === 'string' ? [rules] : rules) : [],
    ageRestrictions,
    skillLevel: "all",
    status,
    bannerImage: images[0] || "",
    gallery: images,
    isPublic: isActive,
    allowSpectators: true,
    spectatorFee: 0,
    requireApproval,
    allowSubstitutes,
  });

  const populatedTournament = await Tournament.findById(tournament._id)
    .populate("venueId", "name address");

  res.status(201).json({
    success: true,
    message: "Tournament created successfully",
    data: populatedTournament,
  });
});

// @desc    Get owner's tournaments with filtering
// @route   GET /api/v1/owner/tournaments
// @access  Private (Owner)
export const getOwnerTournaments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    sportType,
    venueId,
    dateFrom,
    dateTo,
    sortBy = "startDate",
    sortOrder = "desc",
  } = req.query;

  const ownerId = req.user.id;

  // Build query
  const query = { organizerId: ownerId };
  
  if (status) query.status = status;
  if (sportType) query.sportType = sportType;
  if (venueId) query.venueId = venueId;
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (dateFrom || dateTo) {
    query.startDate = {};
    if (dateFrom) query.startDate.$gte = new Date(dateFrom);
    if (dateTo) query.startDate.$lte = new Date(dateTo);
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  // Execute query
  const tournaments = await Tournament.find(query)
    .populate("venueId", "name address")
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Tournament.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      tournaments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Get owner's tournament by ID
// @route   GET /api/v1/owner/tournaments/:id
// @access  Private (Owner)
export const getOwnerTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organizerId: req.user.id,
  })
    .populate("venueId", "name address")
    .populate("participants.user", "name email");

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found or not authorized",
    });
  }

  res.status(200).json({
    success: true,
    data: tournament,
  });
});

// @desc    Create new tournament (Owner)
// @route   POST /api/v1/owner/tournaments
// @access  Private (Owner)
export const createOwnerTournament = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    sportType,
    venueId,
    startDate,
    endDate,
    registrationStartDate,
    registrationEndDate,
    maxParticipants,
    minParticipants,
    entryFee,
    prizePool,
    format,
    rules,
    requirements,
    isActive = true,
    images = [],
  } = req.body;

  // Validate required fields
  if (!name || !sportType || !venueId || !startDate || !endDate || !maxParticipants || !minParticipants) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  // Check if venue exists and belongs to owner
  const venue = await Venue.findOne({ _id: venueId, ownerId: req.user.id });
  if (!venue) {
    return res.status(404).json({
      success: false,
      message: "Venue not found or not authorized",
    });
  }

  // Determine initial status based on dates using status updater
  const tournamentData = {
    registrationStartDate: new Date(registrationStartDate),
    registrationEndDate: new Date(registrationEndDate),
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    status: "upcoming" // Default status, will be updated by status updater
  };
  
  const status = calculateTournamentStatus(tournamentData);

  const tournament = await Tournament.create({
    organizerId: req.user.id,
    venueId,
    name,
    description,
    sportType,
    tournamentType: format || "single_elimination",
    maxParticipants,
    minParticipants,
    teamSize: 1,
    currentParticipants: 0,
    registrationStartDate: new Date(registrationStartDate),
    registrationEndDate: new Date(registrationEndDate),
    registrationFee: entryFee || 0,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    prizePool: prizePool || 0,
    rules: rules ? (typeof rules === 'string' ? [rules] : rules) : [],
    skillLevel: "all",
    status,
    bannerImage: images[0] || "",
    gallery: images,
    isPublic: isActive,
    allowSpectators: true,
    spectatorFee: 0,
    requireApproval: false,
    allowSubstitutes: false,
  });

  const populatedTournament = await Tournament.findById(tournament._id)
    .populate("venueId", "name address");

  res.status(201).json({
    success: true,
    message: "Tournament created successfully",
    data: populatedTournament,
  });
});

// @desc    Update tournament (Owner)
// @route   PUT /api/v1/owner/tournaments/:id
// @access  Private (Owner)
export const updateOwnerTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organizerId: req.user.id,
  });

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found or not authorized",
    });
  }

  // Check if tournament can be updated
  if (tournament.status === "completed" || tournament.status === "cancelled") {
    return res.status(400).json({
      success: false,
      message: "Cannot update completed or cancelled tournament",
    });
  }

  const {
    name,
    description,
    sportType,
    venueId,
    startDate,
    endDate,
    registrationStartDate,
    registrationEndDate,
    maxParticipants,
    minParticipants,
    entryFee,
    prizePool,
    format,
    rules,
    requirements,
    isActive,
    images,
  } = req.body;

  // Update fields
  const updateData = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (sportType) updateData.sportType = sportType;
  if (venueId) updateData.venueId = venueId;
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate) updateData.endDate = new Date(endDate);
  if (registrationStartDate) updateData.registrationStartDate = new Date(registrationStartDate);
  if (registrationEndDate) updateData.registrationEndDate = new Date(registrationEndDate);
  if (maxParticipants) updateData.maxParticipants = maxParticipants;
  if (minParticipants) updateData.minParticipants = minParticipants;
  if (entryFee !== undefined) updateData.registrationFee = entryFee;
  if (prizePool !== undefined) updateData.prizePool = prizePool;
  if (format) updateData.tournamentType = format;
  if (rules) {
    // Handle rules as string or array
    if (typeof rules === 'string') {
      updateData.rules = [rules];
    } else if (Array.isArray(rules)) {
      updateData.rules = rules;
    }
  }
  if (isActive !== undefined) updateData.isPublic = isActive;
  if (images) {
    updateData.gallery = images;
    updateData.bannerImage = images[0] || "";
  }

  // Update tournament
  const updatedTournament = await Tournament.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  )
    .populate("venueId", "name address");

  // Auto-update status based on current time
  if (updatedTournament) {
    const newStatus = calculateTournamentStatus(updatedTournament);
    if (newStatus !== updatedTournament.status) {
      updatedTournament.status = newStatus;
      await updatedTournament.save();
    }
  }

  res.status(200).json({
    success: true,
    message: "Tournament updated successfully",
    data: updatedTournament,
  });
});

// @desc    Delete tournament (Owner)
// @route   DELETE /api/v1/owner/tournaments/:id
// @access  Private (Owner)
export const deleteOwnerTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organizerId: req.user.id,
  });

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found or not authorized",
    });
  }

  // Check if tournament can be deleted
  if (tournament.status === "ongoing" || tournament.status === "completed") {
    return res.status(400).json({
      success: false,
      message: "Cannot delete ongoing or completed tournament",
    });
  }

  await Tournament.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: "Tournament deleted successfully",
  });
});

// @desc    Start tournament (Owner)
// @route   PUT /api/v1/owner/tournaments/:id/start
// @access  Private (Owner)
export const startOwnerTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organizerId: req.user.id,
  });

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found or not authorized",
    });
  }

  if (tournament.status !== "registration_closed") {
    return res.status(400).json({
      success: false,
      message: "Tournament must be in registration_closed status to start",
    });
  }

  tournament.status = "ongoing";
  await tournament.save();

  res.status(200).json({
    success: true,
    message: "Tournament started successfully",
    data: tournament,
  });
});

// @desc    Cancel tournament (Owner)
// @route   PUT /api/v1/owner/tournaments/:id/cancel
// @access  Private (Owner)
export const cancelOwnerTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organizerId: req.user.id,
  });

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found or not authorized",
    });
  }

  if (tournament.status === "completed") {
    return res.status(400).json({
      success: false,
      message: "Cannot cancel completed tournament",
    });
  }

  tournament.status = "cancelled";
  await tournament.save();

  res.status(200).json({
    success: true,
    message: "Tournament cancelled successfully",
    data: tournament,
  });
});

// @desc    Get tournament participants (Owner)
// @route   GET /api/v1/owner/tournaments/:id/participants
// @access  Private (Owner)
export const getOwnerTournamentParticipants = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organizerId: req.user.id,
  });

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found or not authorized",
    });
  }

  const participants = await TournamentRegistration.find({ tournamentId: req.params.id })
    .populate("user", "name email phone")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: participants,
  });
});

// @desc    Get tournament matches (Owner)
// @route   GET /api/v1/owner/tournaments/:id/matches
// @access  Private (Owner)
export const getOwnerTournamentMatches = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organizerId: req.user.id,
  });

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found or not authorized",
    });
  }

  const matches = await TournamentMatch.find({ tournamentId: req.params.id })
    .populate("player1", "name")
    .populate("player2", "name")
    .populate("winner", "name")
    .sort({ round: 1, matchNumber: 1 });

  res.status(200).json({
    success: true,
    data: matches,
  });
});

// @desc    Update match result (Owner)
// @route   PUT /api/v1/owner/tournaments/:id/matches/:matchId
// @access  Private (Owner)
export const updateOwnerMatchResult = asyncHandler(async (req, res) => {
  const { matchId } = req.params;
  const { winnerId, score1, score2, status, notes } = req.body;

  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organizerId: req.user.id,
  });

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found or not authorized",
    });
  }

  const match = await TournamentMatch.findOne({
    _id: matchId,
    tournamentId: req.params.id,
  });

  if (!match) {
    return res.status(404).json({
      success: false,
      message: "Match not found",
    });
  }

  // Update match
  const updateData = {};
  if (winnerId) updateData.winner = winnerId;
  if (score1 !== undefined) updateData.score1 = score1;
  if (score2 !== undefined) updateData.score2 = score2;
  if (status) updateData.status = status;
  if (notes) updateData.notes = notes;

  const updatedMatch = await TournamentMatch.findByIdAndUpdate(
    matchId,
    updateData,
    { new: true }
  )
    .populate("player1", "name")
    .populate("player2", "name")
    .populate("winner", "name");

  res.status(200).json({
    success: true,
    message: "Match result updated successfully",
    data: updatedMatch,
  });
});

// @desc    Upload tournament images (Owner)
// @route   POST /api/v1/owner/tournaments/:id/upload-images
// @access  Private (Owner)
export const uploadOwnerTournamentImages = asyncHandler(async (req, res) => {
  const tournament = await Tournament.findOne({
    _id: req.params.id,
    organizerId: req.user.id,
  });

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "Tournament not found or not authorized",
    });
  }

  // Handle file uploads
  const images = req.files?.map(file => file.path) || [];

  if (images.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No images uploaded",
    });
  }

  // Update tournament with new images
  tournament.gallery = [...tournament.gallery, ...images];
  if (!tournament.bannerImage && images.length > 0) {
    tournament.bannerImage = images[0];
  }
  await tournament.save();

  res.status(200).json({
    success: true,
    message: "Images uploaded successfully",
    data: {
      images,
      gallery: tournament.gallery,
    },
  });
});

// @desc    Get tournament statistics (Owner)
// @route   GET /api/v1/owner/tournaments/stats
// @access  Private (Owner)
export const getOwnerTournamentStats = asyncHandler(async (req, res) => {
  const ownerId = req.user.id;

  const [
    totalTournaments,
    activeTournaments,
    upcomingTournaments,
    aboutToStartTournaments,
    ongoingTournaments,
    completedTournaments,
    cancelledTournaments,
    totalParticipants,
    totalPrizePool,
    sportTypeStats,
  ] = await Promise.all([
    Tournament.countDocuments({ organizerId: ownerId }),
    Tournament.countDocuments({ 
      organizerId: ownerId, 
      status: { $in: ["ongoing", "about_to_start"] }
    }),
    Tournament.countDocuments({ 
      organizerId: ownerId, 
      status: "upcoming" 
    }),
    Tournament.countDocuments({ 
      organizerId: ownerId, 
      status: "about_to_start" 
    }),
    Tournament.countDocuments({ 
      organizerId: ownerId, 
      status: "ongoing" 
    }),
    Tournament.countDocuments({ 
      organizerId: ownerId, 
      status: "completed" 
    }),
    Tournament.countDocuments({ 
      organizerId: ownerId, 
      status: "cancelled" 
    }),
    Tournament.aggregate([
      { $match: { organizerId: new mongoose.Types.ObjectId(ownerId) } },
      { $group: { _id: null, total: { $sum: "$currentParticipants" } } }
    ]),
    Tournament.aggregate([
      { $match: { organizerId: new mongoose.Types.ObjectId(ownerId) } },
      { $group: { _id: null, total: { $sum: "$prizePool" } } }
    ]),
    Tournament.aggregate([
      { $match: { organizerId: new mongoose.Types.ObjectId(ownerId) } },
      { $group: { _id: "$sportType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalTournaments,
      activeTournaments,
      upcomingTournaments,
      aboutToStartTournaments,
      ongoingTournaments,
      completedTournaments,
      cancelledTournaments,
      totalParticipants: totalParticipants[0]?.total || 0,
      totalPrizePool: totalPrizePool[0]?.total || 0,
      sportTypeStats: sportTypeStats.map(stat => ({
        sportType: stat._id,
        count: stat.count
      }))
    },
  });
});

// @desc    Update tournament statuses (Owner)
// @route   POST /api/v1/owner/tournaments/update-statuses
// @access  Private (Owner)
export const updateOwnerTournamentStatusesAPI = asyncHandler(async (req, res) => {
  const ownerId = req.user.id;
  
  try {
    const result = await updateOwnerTournamentStatuses(ownerId);
    
    res.status(200).json({
      success: true,
      message: `Updated ${result.updatedCount} tournament statuses`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update tournament statuses",
      error: error.message
    });
  }
});

// @desc    Update single tournament status (Owner)
// @route   POST /api/v1/owner/tournaments/:id/update-status
// @access  Private (Owner)
export const updateSingleTournamentStatusAPI = asyncHandler(async (req, res) => {
  const tournamentId = req.params.id;
  const ownerId = req.user.id;
  
  try {
    // Check if tournament belongs to owner
    const tournament = await Tournament.findOne({
      _id: tournamentId,
      organizerId: ownerId
    });
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: "Tournament not found or not authorized"
      });
    }
    
    const updatedTournament = await updateTournamentStatus(tournamentId);
    
    res.status(200).json({
      success: true,
      message: "Tournament status updated successfully",
      data: {
        tournamentId: updatedTournament._id,
        name: updatedTournament.name,
        oldStatus: tournament.status,
        newStatus: updatedTournament.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update tournament status",
      error: error.message
    });
  }
});

// @desc    Get latest 3 active tournaments (Public)
// @route   GET /api/v1/tournaments/latest-active
// @access  Public
export const getLatestActiveTournaments = asyncHandler(async (req, res) => {
  console.log("Getting latest active tournaments...");
  
  // First, let's check total tournaments in database
  const totalTournaments = await Tournament.countDocuments();
  console.log(`Total tournaments in database: ${totalTournaments}`);
  
  const tournaments = await Tournament.find({
    status: { $nin: ["completed", "cancelled"] }, // Loại trừ các giải đấu đã hoàn thành hoặc đã hủy
  })
    .sort({ createdAt: -1 }) // Sắp xếp theo thời gian tạo giảm dần (mới nhất trước)
    .limit(3) // Giới hạn 3 giải đấu
    .populate("venueId", "name address images") // Populate thông tin venue
    .select("-__v -updatedAt"); // Loại bỏ các trường không cần thiết

  console.log(`Found ${tournaments.length} active tournaments:`, tournaments.map(t => ({ name: t.name, status: t.status })));

  res.status(200).json({
    success: true,
    data: tournaments,
  });
});

// Test API to get all tournaments (for debugging)
export const getAllTournamentsForDebug = asyncHandler(async (req, res) => {
  console.log("Getting ALL tournaments for debug...");
  
  const allTournaments = await Tournament.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .select("name status createdAt");

  console.log(`Found ${allTournaments.length} total tournaments:`, allTournaments);

  res.status(200).json({
    success: true,
    data: allTournaments,
  });
});

// Create a test tournament for debugging
export const createTestTournament = asyncHandler(async (req, res) => {
  console.log("Creating test tournament...");
  
  const testTournament = await Tournament.create({
    organizerId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"), // Fake ObjectId
    venueId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"), // Fake ObjectId
    name: "Test Tournament",
    description: "This is a test tournament",
    sportType: "football",
    tournamentType: "single_elimination",
    maxParticipants: 16,
    minParticipants: 8,
    teamSize: 1,
    registrationStartDate: new Date(),
    registrationEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    registrationFee: 100000,
    startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
    prizePool: 1000000,
    status: "registration_open",
    isPublic: true,
    allowSpectators: true,
    spectatorFee: 0,
    requireApproval: false,
    allowSubstitutes: false,
  });

  console.log("Test tournament created:", testTournament);

  res.status(201).json({
    success: true,
    data: testTournament,
  });
});