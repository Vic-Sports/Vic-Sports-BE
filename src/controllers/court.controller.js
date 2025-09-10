import Court from "../models/court.js";
import Venue from "../models/venue.js";

// @desc    Create Court
// @route   POST /api/courts
// @access Private (Owner)
export const createCourt = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const {
      venueId,
      name,
      sportType,
      courtType,
      capacity,
      dimensions,
      surface,
      equipment,
      pricing,
      defaultAvailability,
    } = req.body;

    // Validate required fields
    if (!venueId || !name || !sportType || !capacity) {
      return res.status(400).json({
        success: false,
        message: "Venue ID, name, sport type, and capacity are required",
      });
    }

    // Check if venue exists and user is the owner
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    if (!venue.ownerId.equals(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to add courts to this venue",
      });
    }

    const court = await Court.create({
      venueId,
      name,
      sportType,
      courtType,
      capacity,
      dimensions,
      surface,
      equipment,
      pricing,
      defaultAvailability,
    });

    res.status(201).json({
      success: true,
      message: "Court created successfully",
      data: {
        court,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get All Courts
// @route   GET /api/courts
// @access Public
export const getAllCourts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      venueId,
      sportType,
      minPrice,
      maxPrice,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { isActive: true };

    // Filter by venue
    if (venueId) {
      query.venueId = venueId;
    }

    // Filter by sport type
    if (sportType) {
      query.sportType = sportType;
    }

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const courts = await Court.find(query)
      .populate("venueId", "name address ratings")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Court.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        courts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCourts: total,
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

// @desc    Get Court by ID
// @route   GET /api/courts/:courtId
// @access Public
export const getCourtById = async (req, res) => {
  try {
    const { courtId } = req.params;

    const court = await Court.findById(courtId)
      .populate("venueId", "name address contactInfo amenities");

    if (!court) {
      return res.status(404).json({
        success: false,
        message: "Court not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        court,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update Court
// @route   PUT /api/courts/:courtId
// @access Private (Owner)
export const updateCourt = async (req, res) => {
  try {
    const { courtId } = req.params;
    const ownerId = req.user.id;
    const updateData = req.body;

    const court = await Court.findById(courtId).populate("venueId");
    if (!court) {
      return res.status(404).json({
        success: false,
        message: "Court not found",
      });
    }

    // Check if user is the venue owner
    if (!court.venueId.ownerId.equals(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this court",
      });
    }

    // Update court
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        court[key] = updateData[key];
      }
    });

    await court.save();

    res.status(200).json({
      success: true,
      message: "Court updated successfully",
      data: {
        court,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete Court
// @route   DELETE /api/courts/:courtId
// @access Private (Owner)
export const deleteCourt = async (req, res) => {
  try {
    const { courtId } = req.params;
    const ownerId = req.user.id;

    const court = await Court.findById(courtId).populate("venueId");
    if (!court) {
      return res.status(404).json({
        success: false,
        message: "Court not found",
      });
    }

    // Check if user is the venue owner
    if (!court.venueId.ownerId.equals(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this court",
      });
    }

    court.isActive = false;
    await court.save();

    res.status(200).json({
      success: true,
      message: "Court deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Courts by Venue
// @route   GET /api/courts/venue/:venueId
// @access Public
export const getCourtsByVenue = async (req, res) => {
  try {
    const { venueId } = req.params;

    const courts = await Court.find({ venueId, isActive: true })
      .populate("venueId", "name address");

    res.status(200).json({
      success: true,
      data: {
        courts,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Courts by Sport Type
// @route   GET /api/courts/sport/:sportType
// @access Public
export const getCourtsBySport = async (req, res) => {
  try {
    const { sportType } = req.params;
    const { page = 1, limit = 10, city, district } = req.query;

    const query = { sportType, isActive: true };

    // If location filters are provided, filter by venue location
    if (city || district) {
      const venueQuery = { isActive: true, isVerified: true };
      if (city) venueQuery["address.city"] = city;
      if (district) venueQuery["address.district"] = district;

      const venues = await Venue.find(venueQuery).select("_id");
      const venueIds = venues.map(venue => venue._id);
      query.venueId = { $in: venueIds };
    }

    const courts = await Court.find(query)
      .populate("venueId", "name address ratings")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Court.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        courts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCourts: total,
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

// @desc    Check Court Availability
// @route   GET /api/courts/:courtId/availability
// @access Public
export const checkCourtAvailability = async (req, res) => {
  try {
    const { courtId } = req.params;
    const { date, startTime, endTime } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({
        success: false,
        message: "Court not found",
      });
    }

    // Get day of week (0 = Sunday, 1 = Monday, etc.)
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    // Find default availability for this day
    const dayAvailability = court.defaultAvailability.find(
      day => day.dayOfWeek === dayOfWeek
    );

    if (!dayAvailability) {
      return res.status(200).json({
        success: true,
        data: {
          available: false,
          reason: "Court not available on this day",
          timeSlots: [],
        },
      });
    }

    // Filter time slots based on requested time range
    let availableSlots = dayAvailability.timeSlots.filter(slot => slot.isAvailable);

    if (startTime && endTime) {
      availableSlots = availableSlots.filter(slot => {
        return slot.start >= startTime && slot.end <= endTime;
      });
    }

    res.status(200).json({
      success: true,
      data: {
        available: availableSlots.length > 0,
        timeSlots: availableSlots,
        courtInfo: {
          name: court.name,
          sportType: court.sportType,
          capacity: court.capacity,
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

// @desc    Get Court Pricing
// @route   GET /api/courts/:courtId/pricing
// @access Public
export const getCourtPricing = async (req, res) => {
  try {
    const { courtId } = req.params;
    const { date, timeSlot } = req.query;

    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({
        success: false,
        message: "Court not found",
      });
    }

    // Determine day type
    let dayType = "weekday";
    if (date) {
      const requestedDate = new Date(date);
      const dayOfWeek = requestedDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        dayType = "weekend";
      }
    }

    // Find applicable pricing
    const applicablePricing = court.pricing.filter(price => {
      if (!price.isActive) return false;
      if (price.dayType && price.dayType !== dayType) return false;
      if (timeSlot && price.timeSlot) {
        return timeSlot >= price.timeSlot.start && timeSlot <= price.timeSlot.end;
      }
      return true;
    });

    res.status(200).json({
      success: true,
      data: {
        pricing: applicablePricing,
        dayType,
        courtInfo: {
          name: court.name,
          sportType: court.sportType,
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

// @desc    Upload Court Images
// @route   POST /api/courts/:courtId/images
// @access Private (Owner)
export const uploadCourtImages = async (req, res) => {
  try {
    const { courtId } = req.params;
    const ownerId = req.user.id;
    const { images } = req.body;

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({
        success: false,
        message: "Images array is required",
      });
    }

    const court = await Court.findById(courtId).populate("venueId");
    if (!court) {
      return res.status(404).json({
        success: false,
        message: "Court not found",
      });
    }

    // Check if user is the venue owner
    if (!court.venueId.ownerId.equals(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this court",
      });
    }

    court.images = [...(court.images || []), ...images];
    await court.save();

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: {
        images: court.images,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Available Sport Types
// @route   GET /api/courts/sports
// @access Public
export const getAvailableSports = async (req, res) => {
  try {
    const sports = await Court.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$sportType",
          courtCount: { $sum: 1 },
        },
      },
      { $sort: { courtCount: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        sports,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Court Stats
// @route   GET /api/courts/:courtId/stats
// @access Private (Owner)
export const getCourtStats = async (req, res) => {
  try {
    const { courtId } = req.params;
    const ownerId = req.user.id;

    const court = await Court.findById(courtId).populate("venueId");
    if (!court) {
      return res.status(404).json({
        success: false,
        message: "Court not found",
      });
    }

    // Check if user is the venue owner
    if (!court.venueId.ownerId.equals(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this court's stats",
      });
    }

    // Get booking stats (placeholder - will be implemented with booking model)
    const stats = {
      totalBookings: court.totalBookings,
      totalRevenue: court.totalRevenue,
      averageRating: court.ratings.average,
      totalReviews: court.ratings.count,
      isActive: court.isActive,
      createdAt: court.createdAt,
    };

    res.status(200).json({
      success: true,
      data: {
        stats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
