import Venue from "../models/venue.js";
import Court from "../models/court.js";
import Location from "../models/location.js";

// Sport type mapping for bilingual support
const sportTypeMapping = {
  football: ["football", "bóng đá", "soccer"],
  "bóng đá": ["football", "bóng đá", "soccer"],
  basketball: ["basketball", "bóng rổ"],
  "bóng rổ": ["basketball", "bóng rổ"],
  badminton: ["badminton", "cầu lông"],
  "cầu lông": ["badminton", "cầu lông"],
  tennis: ["tennis"],
  volleyball: ["volleyball", "bóng chuyền"],
  "bóng chuyền": ["volleyball", "bóng chuyền"],
  pingpong: ["pingpong", "bóng bàn", "table tennis"],
  "bóng bàn": ["pingpong", "bóng bàn", "table tennis"],
};

// @desc    Search Venues with Advanced Filters
// @route   POST /api/venues/search
// @access Public
export const searchVenues = async (req, res) => {
  try {
    const {
      sportType,
      location,
      rating,
      isVerified,
      sortBy = "rating",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.body;

    let query = { isActive: true };

    // Location filter - search in city, district, or ward
    if (location) {
      query.$or = [
        { "address.city": new RegExp(location, "i") },
        { "address.district": new RegExp(location, "i") },
        { "address.ward": new RegExp(location, "i") },
      ];
    }

    // Sport type filter - find venues with courts of specific sport type
    if (sportType) {
      // Get all possible sport type variations
      const sportVariations = sportTypeMapping[sportType.toLowerCase()] || [
        sportType,
      ];

      // Create regex pattern for all variations
      const sportRegexPattern = sportVariations
        .map((sport) => sport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

      const courts = await Court.find({
        sportType: new RegExp(sportRegexPattern, "i"),
        isActive: true,
      }).select("venueId");

      const venueIds = courts.map((court) => court.venueId);

      if (query._id) {
        // If there's already an _id filter, intersect with sport type venues
        query._id = { $in: venueIds };
      } else {
        query._id = { $in: venueIds };
      }
    }

    // Rating filter
    if (rating && !isNaN(rating)) {
      query["ratings.average"] = { $gte: parseFloat(rating) };
    }

    // Verified filter
    if (isVerified !== undefined) {
      query.isVerified = isVerified;
    }

    // Sort options
    let sortOption = {};
    if (sortBy === "rating") {
      sortOption["ratings.average"] = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "name") {
      sortOption.name = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "createdAt") {
      sortOption.createdAt = sortOrder === "desc" ? -1 : 1;
    } else {
      sortOption["ratings.average"] = -1; // Default sort by rating desc
    }

    // Execute query with pagination
    const venues = await Venue.find(query)
      .populate("ownerId", "fullName email phone")
      .populate({
        path: "courts",
        select: "sportType",
        match: { isActive: true },
      })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort(sortOption);

    const total = await Venue.countDocuments(query);

    const response = {
      venues,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    res.status(200).json({
      statusCode: 200,
      message: "Venues fetched successfully",
      data: response,
    });
  } catch (error) {
    console.error("Search venues error:", error);
    res.status(500).json({
      statusCode: 500,
      message: "Failed to search venues",
      error: error.message,
    });
  }
};

// @desc    Create Venue
// @route   POST /api/venues
// @access Private (Owner)
export const createVenue = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const {
      name,
      description,
      address,
      contactInfo,
      amenities,
      operatingHours,
      parking,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !address ||
      !address.street ||
      !address.ward ||
      !address.district ||
      !address.city
    ) {
      return res.status(400).json({
        success: false,
        message: "Name and complete address are required",
      });
    }

    const venue = await Venue.create({
      ownerId,
      name,
      description,
      address,
      contactInfo,
      amenities,
      operatingHours,
      parking,
    });

    res.status(201).json({
      success: true,
      message: "Venue created successfully",
      data: {
        venue,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get All Venues
// @route   GET /api/venues
// @access Public
export const getAllVenues = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      city,
      district,
      sportType,
      minPrice,
      maxPrice,
      rating,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { isActive: true, isVerified: true };

    // Filter by location
    if (city) query["address.city"] = city;
    if (district) query["address.district"] = district;

    // Filter by sport type (through courts)
    if (sportType) {
      // Get all possible sport type variations
      const sportVariations = sportTypeMapping[sportType.toLowerCase()] || [
        sportType,
      ];

      // Create regex pattern for all variations
      const sportRegexPattern = sportVariations
        .map((sport) => sport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

      const courts = await Court.find({
        sportType: new RegExp(sportRegexPattern, "i"),
        isActive: true,
      }).select("venueId");

      const venueIds = courts.map((court) => court.venueId);
      query._id = { $in: venueIds };
    }

    // Filter by rating
    if (rating) {
      query["ratings.average"] = { $gte: parseFloat(rating) };
    }

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const venues = await Venue.find(query)
      .populate("ownerId", "fullName")
      .populate({
        path: "courts",
        select: "sportType",
        match: { isActive: true },
      })
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Venue.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        venues,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalVenues: total,
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

// @desc    Get Venue by ID
// @route   GET /api/venues/:venueId
// @access Public
export const getVenueById = async (req, res) => {
  try {
    const { venueId } = req.params;

    const venue = await Venue.findById(venueId)
      .populate("ownerId", "fullName email phone")
      .populate({
        path: "courts",
        select: "name sportType courtType capacity surface pricing",
        match: { isActive: true },
      });

    if (!venue) {
      return res.status(404).json({
        success: false,
        error: {
          code: "VENUE_NOT_FOUND",
          message: "Venue không tồn tại",
        },
      });
    }

    if (!venue.isActive) {
      return res.status(403).json({
        success: false,
        error: {
          code: "VENUE_INACTIVE",
          message: "Venue hiện tại không hoạt động",
        },
      });
    }

    res.status(200).json({
      success: true,
      data: venue,
    });
  } catch (error) {
    console.error("Error getting venue:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Lỗi server",
      },
    });
  }
};

// @desc    Get Venue Courts with Filters
// @route   GET /api/venues/:venueId/courts
// @access Public
export const getVenueCourts = async (req, res) => {
  try {
    const { venueId } = req.params;
    const {
      sportType,
      courtType,
      capacity,
      sortBy = "rating",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    // Check if venue exists
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        error: {
          code: "VENUE_NOT_FOUND",
          message: "Venue không tồn tại",
        },
      });
    }

    if (!venue.isActive) {
      return res.status(403).json({
        success: false,
        error: {
          code: "VENUE_INACTIVE",
          message: "Venue hiện tại không hoạt động",
        },
      });
    }

    // Build filter
    const filter = {
      venueId: venueId,
      isActive: true,
    };

    if (sportType) {
      // Get all possible sport type variations
      const sportVariations = sportTypeMapping[sportType.toLowerCase()] || [
        sportType,
      ];
      const sportRegexPattern = sportVariations
        .map((sport) => sport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      filter.sportType = new RegExp(sportRegexPattern, "i");
    }
    if (courtType) filter.courtType = courtType;
    if (capacity) filter.capacity = { $gte: parseInt(capacity) };

    // Build sort
    const sortOptions = {};
    switch (sortBy) {
      case "rating":
        sortOptions["ratings.average"] = sortOrder === "desc" ? -1 : 1;
        break;
      case "price":
        sortOptions["pricing.0.pricePerHour"] = sortOrder === "desc" ? -1 : 1;
        break;
      case "name":
        sortOptions.name = sortOrder === "desc" ? -1 : 1;
        break;
      case "capacity":
        sortOptions.capacity = sortOrder === "desc" ? -1 : 1;
        break;
      default:
        sortOptions["ratings.average"] = -1;
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get all courts for this venue
    const courts = await Court.find({
      venueId: venueId,
      isActive: true,
    }).sort({ name: 1 });

    // Group courts by sport type (as required by FE)
    const groupedCourts = {};
    courts.forEach((court) => {
      if (!groupedCourts[court.sportType]) {
        groupedCourts[court.sportType] = [];
      }
      groupedCourts[court.sportType].push(court);
    });

    // Create sport type groups with aggregated info for FE
    const sportTypeGroups = Object.keys(groupedCourts).map((sportType) => {
      const sportCourts = groupedCourts[sportType];

      // Calculate min/max prices across all courts of this sport type
      const allPrices = [];
      sportCourts.forEach((court) => {
        court.pricing.forEach((pricing) => {
          if (pricing.isActive) {
            allPrices.push(pricing.pricePerHour);
          }
        });
      });

      // Calculate average rating for this sport type
      const totalRatings = sportCourts.reduce(
        (sum, court) => sum + (court.ratings.average || 0),
        0
      );
      const averageRating =
        sportCourts.length > 0 ? totalRatings / sportCourts.length : 0;

      return {
        sportType,
        courts: sportCourts,
        sampleCourt: sportCourts[0], // Representative court for displaying
        totalCourts: sportCourts.length,
        minPrice: allPrices.length > 0 ? Math.min(...allPrices) : 0,
        maxPrice: allPrices.length > 0 ? Math.max(...allPrices) : 0,
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      };
    });

    res.status(200).json({
      success: true,
      data: {
        venue: {
          _id: venue._id,
          name: venue.name,
          address: venue.address,
          ratings: venue.ratings,
        },
        courts: courts, // All courts for compatibility
        sportTypeGroups: sportTypeGroups, // Main data for FE logic
      },
    });
  } catch (error) {
    console.error("Error getting venue courts:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Lỗi server",
      },
    });
  }
};

// @desc    Update Venue
// @route   PUT /api/venues/:venueId
// @access Private (Owner)
export const updateVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const ownerId = req.user.id;
    const updateData = req.body;

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    // Check if user is the owner
    if (!venue.ownerId.equals(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this venue",
      });
    }

    // Update venue
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        venue[key] = updateData[key];
      }
    });

    await venue.save();

    res.status(200).json({
      success: true,
      message: "Venue updated successfully",
      data: {
        venue,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete Venue
// @route   DELETE /api/venues/:venueId
// @access Private (Owner)
export const deleteVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const ownerId = req.user.id;

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    // Check if user is the owner
    if (!venue.ownerId.equals(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this venue",
      });
    }

    venue.isActive = false;
    await venue.save();

    res.status(200).json({
      success: true,
      message: "Venue deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Upload Venue Images
// @route   POST /api/venues/:venueId/images
// @access Private (Owner)
export const uploadVenueImages = async (req, res) => {
  try {
    const { venueId } = req.params;
    const ownerId = req.user.id;
    const { images } = req.body;

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({
        success: false,
        message: "Images array is required",
      });
    }

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    // Check if user is the owner
    if (!venue.ownerId.equals(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this venue",
      });
    }

    venue.images = [...(venue.images || []), ...images];
    await venue.save();

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: {
        images: venue.images,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Remove Venue Image
// @route   DELETE /api/venues/:venueId/images/:imageIndex
// @access Private (Owner)
export const removeVenueImage = async (req, res) => {
  try {
    const { venueId, imageIndex } = req.params;
    const ownerId = req.user.id;

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    // Check if user is the owner
    if (!venue.ownerId.equals(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this venue",
      });
    }

    if (venue.images && venue.images[imageIndex]) {
      venue.images.splice(imageIndex, 1);
      await venue.save();
    }

    res.status(200).json({
      success: true,
      message: "Image removed successfully",
      data: {
        images: venue.images,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Venue Stats
// @route   GET /api/venues/:venueId/stats
// @access Private (Owner)
export const getVenueStats = async (req, res) => {
  try {
    const { venueId } = req.params;
    const ownerId = req.user.id;

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    // Check if user is the owner
    if (!venue.ownerId.equals(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this venue's stats",
      });
    }

    // Get court count
    const courtCount = await Court.countDocuments({ venueId, isActive: true });

    // Get booking stats (placeholder - will be implemented with booking model)
    const bookingStats = {
      totalBookings: venue.totalBookings,
      totalRevenue: venue.totalRevenue,
      averageRating: venue.ratings.average,
      totalReviews: venue.ratings.count,
    };

    res.status(200).json({
      success: true,
      data: {
        stats: {
          ...bookingStats,
          courtCount,
          isVerified: venue.isVerified,
          isActive: venue.isActive,
          createdAt: venue.createdAt,
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

// @desc    Search Venues by Location
// @route   GET /api/venues/search/location
// @access Public
export const searchVenuesByLocation = async (req, res) => {
  try {
    const { lat, lng, radius = 10, sportType } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const query = {
      isActive: true,
      isVerified: true,
      "address.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radius * 1000, // Convert km to meters
        },
      },
    };

    // Filter by sport type if provided
    if (sportType) {
      // Get all possible sport type variations
      const sportVariations = sportTypeMapping[sportType.toLowerCase()] || [
        sportType,
      ];

      // Create regex pattern for all variations
      const sportRegexPattern = sportVariations
        .map((sport) => sport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

      const courts = await Court.find({
        sportType: new RegExp(sportRegexPattern, "i"),
        isActive: true,
      }).select("venueId");

      const venueIds = courts.map((court) => court.venueId);
      query._id = { $in: venueIds };
    }

    const venues = await Venue.find(query)
      .populate("ownerId", "fullName")
      .limit(20);

    res.status(200).json({
      success: true,
      data: {
        venues,
        searchParams: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radius: parseInt(radius),
          sportType,
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

// @desc    Get Venues by Owner
// @route   GET /api/venues/owner/:ownerId
// @access Private (Owner)
export const getVenuesByOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const currentUserId = req.user.id;

    // Check if user is requesting their own venues or is admin
    if (ownerId !== currentUserId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view these venues",
      });
    }

    const venues = await Venue.find({ ownerId })
      .populate("ownerId", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        venues,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Available Cities
// @route   GET /api/venues/cities
// @access Public
export const getAvailableCities = async (req, res) => {
  try {
    const cities = await Venue.aggregate([
      { $match: { isActive: true, isVerified: true } },
      {
        $group: {
          _id: "$address.city",
          venueCount: { $sum: 1 },
        },
      },
      { $sort: { venueCount: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        cities,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Seed Sample Venue Data (Development Only)
// @route   POST /api/venues/seed-sample-data
// @access Public (Remove in production)
// export const seedSampleVenueData = async (req, res) => {
//   try {
//     const result = await seedSampleData();

//     if (result.success) {
//       res.status(200).json({
//         statusCode: 200,
//         message: result.message,
//         data: {
//           success: true,
//         },
//       });
//     } else {
//       res.status(500).json({
//         statusCode: 500,
//         message: "Failed to seed sample data",
//         error: result.error,
//       });
//     }
//   } catch (error) {
//     res.status(500).json({
//       statusCode: 500,
//       message: "Failed to seed sample data",
//       error: error.message,
//     });
//   }
// };

// @desc    Get Districts by City
// @route   GET /api/venues/districts/:city
// @access Public
export const getDistrictsByCity = async (req, res) => {
  try {
    const { city } = req.params;

    const districts = await Venue.aggregate([
      { $match: { isActive: true, isVerified: true, "address.city": city } },
      {
        $group: {
          _id: "$address.district",
          venueCount: { $sum: 1 },
        },
      },
      { $sort: { venueCount: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        districts,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get available courts count by sport type in venue
// @route   GET /api/v1/venues/:venueId/courts/availability-count
// @access  Public
export const getVenueCourtAvailabilityCount = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { date, startTime, endTime, sportType } = req.query;

    // Validate required parameters
    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Date, startTime và endTime là bắt buộc",
      });
    }

    // Check if venue exists
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy venue",
      });
    }

    // Build query for courts in this venue
    let courtQuery = {
      venueId: venueId,
      isActive: true,
    };

    // Add sport type filter if provided
    if (sportType) {
      // Get all possible sport type variations (support bilingual)
      const sportVariations = sportTypeMapping[sportType.toLowerCase()] || [
        sportType,
      ];
      courtQuery.sportType = {
        $in: sportVariations.map((sport) => new RegExp(sport, "i")),
      };
    }

    // Get all courts in venue (filtered by sport type if provided)
    const courts = await Court.find(courtQuery);

    if (courts.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          venueId,
          venueName: venue.name,
          date,
          timeSlot: { startTime, endTime },
          sportType: sportType || "all",
          totalCourts: 0,
          availableCourts: 0,
          bookedCourts: 0,
          reservedCourts: 0,
          courtBreakdown: [],
        },
      });
    }

    // Import Booking model
    const Booking = (await import("../models/booking.js")).default;

    // Check bookings for the specified date and time
    const bookingDate = new Date(date);
    const requestedSlot = { start: startTime, end: endTime };

    const bookings = await Booking.find({
      venue: venueId,
      date: bookingDate,
      status: { $in: ["reserved", "confirmed"] },
      court: { $in: courts.map((c) => c._id) },
    }).populate("court", "name sportType");

    // Filter active bookings (not expired reservations)
    const now = new Date();
    const activeBookings = bookings.filter((booking) => {
      if (booking.status === "confirmed") return true;
      if (booking.status === "reserved") {
        return new Date(booking.reservationExpiresAt) > now;
      }
      return false;
    });

    // Check which bookings conflict with requested time slot
    const conflictingBookings = activeBookings.filter((booking) => {
      return booking.timeSlots.some((bookingSlot) =>
        timeSlotsOverlap(requestedSlot, bookingSlot)
      );
    });

    // Group courts by sport type for detailed breakdown
    const courtsBySportType = {};

    courts.forEach((court) => {
      const sport = court.sportType.toLowerCase();
      if (!courtsBySportType[sport]) {
        courtsBySportType[sport] = {
          sportType: court.sportType,
          totalCourts: 0,
          availableCourts: 0,
          bookedCourts: 0,
          reservedCourts: 0,
          courts: [],
        };
      }

      const isBooked = conflictingBookings.some(
        (booking) => booking.court._id.toString() === court._id.toString()
      );

      const conflictingBooking = conflictingBookings.find(
        (booking) => booking.court._id.toString() === court._id.toString()
      );

      const courtStatus = isBooked
        ? conflictingBooking.status === "confirmed"
          ? "booked"
          : "reserved"
        : "available";

      courtsBySportType[sport].totalCourts++;
      if (courtStatus === "available") {
        courtsBySportType[sport].availableCourts++;
      } else if (courtStatus === "booked") {
        courtsBySportType[sport].bookedCourts++;
      } else if (courtStatus === "reserved") {
        courtsBySportType[sport].reservedCourts++;
      }

      courtsBySportType[sport].courts.push({
        courtId: court._id,
        courtName: court.name,
        status: courtStatus,
        reservationExpiresAt: conflictingBooking?.reservationExpiresAt || null,
      });
    });

    // Calculate totals
    const totalCourts = courts.length;
    const bookedCourtsCount = conflictingBookings.filter(
      (b) => b.status === "confirmed"
    ).length;
    const reservedCourtsCount = conflictingBookings.filter(
      (b) => b.status === "reserved"
    ).length;
    const availableCourtsCount =
      totalCourts - bookedCourtsCount - reservedCourtsCount;

    res.status(200).json({
      success: true,
      data: {
        venueId,
        venueName: venue.name,
        date,
        timeSlot: { startTime, endTime },
        sportType: sportType || "all",
        totalCourts,
        availableCourts: availableCourtsCount,
        bookedCourts: bookedCourtsCount,
        reservedCourts: reservedCourtsCount,
        courtBreakdown: Object.values(courtsBySportType),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Available Time Slots for Multiple Courts
export const getAvailableTimeSlotsForMultipleCourts = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { date, courtQuantity, sportType, duration } = req.query;

    // Validate required parameters
    if (!date || !courtQuantity) {
      return res.status(400).json({
        success: false,
        message: "Date và courtQuantity là bắt buộc",
      });
    }

    const requestedQuantity = parseInt(courtQuantity);
    const durationHours = parseInt(duration) || 2; // Default 2 hours

    // Check if venue exists
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy venue",
      });
    }

    // Build query for courts in this venue
    let courtQuery = {
      venueId: venueId,
      isActive: true,
    };

    // Add sport type filter if provided
    if (sportType) {
      const sportVariations = sportTypeMapping[sportType.toLowerCase()] || [
        sportType,
      ];
      courtQuery.sportType = {
        $in: sportVariations.map((sport) => new RegExp(sport, "i")),
      };
    }

    // Get all courts in venue (filtered by sport type if provided)
    const courts = await Court.find(courtQuery);

    if (courts.length < requestedQuantity) {
      return res.status(200).json({
        success: true,
        data: {
          venueId,
          venueName: venue.name,
          date,
          requestedQuantity,
          availableTimeSlots: [],
          unavailableTimeSlots: [],
          message: `Venue chỉ có ${courts.length} sân ${
            sportType || "tổng"
          }, không đủ ${requestedQuantity} sân yêu cầu`,
        },
      });
    }

    // Import Booking model
    const Booking = (await import("../models/booking.js")).default;

    // Get all bookings for the date
    const bookingDate = new Date(date);
    const bookings = await Booking.find({
      venue: venueId,
      date: bookingDate,
      status: { $in: ["reserved", "confirmed"] },
      court: { $in: courts.map((c) => c._id) },
    }).populate("court", "name sportType pricing");

    // Filter active bookings (not expired reservations)
    const now = new Date();
    const activeBookings = bookings.filter((booking) => {
      if (booking.status === "confirmed") return true;
      if (booking.status === "reserved") {
        return new Date(booking.reservationExpiresAt) > now;
      }
      return false;
    });

    // Generate possible time slots (8:00 - 22:00)
    const possibleSlots = [];
    for (let hour = 8; hour <= 22 - durationHours; hour++) {
      const startTime = `${hour.toString().padStart(2, "0")}:00`;
      const endTime = `${(hour + durationHours)
        .toString()
        .padStart(2, "0")}:00`;
      possibleSlots.push({ start: startTime, end: endTime });
    }

    const availableTimeSlots = [];
    const unavailableTimeSlots = [];

    // Check each time slot
    for (const timeSlot of possibleSlots) {
      const availableCourts = [];

      // Check which courts are available for this time slot
      for (const court of courts) {
        const isConflicting = activeBookings.some((booking) => {
          if (booking.court._id.toString() !== court._id.toString())
            return false;
          return booking.timeSlots.some((bookingSlot) =>
            timeSlotsOverlap(timeSlot, bookingSlot)
          );
        });

        if (!isConflicting) {
          // Get pricing for this court and time slot
          const pricing = getCourtPricing(court, timeSlot, date);
          availableCourts.push({
            courtId: court._id,
            courtName: court.name,
            price: pricing.pricePerHour * durationHours,
            pricePerHour: pricing.pricePerHour,
          });
        }
      }

      if (availableCourts.length >= requestedQuantity) {
        // Sort by price to get cheapest combination
        availableCourts.sort((a, b) => a.price - b.price);
        const recommendedCourts = availableCourts.slice(0, requestedQuantity);
        const totalPrice = recommendedCourts.reduce(
          (sum, court) => sum + court.price,
          0
        );

        availableTimeSlots.push({
          start: timeSlot.start,
          end: timeSlot.end,
          availableCourts: availableCourts.length,
          courtsInfo: availableCourts,
          recommendedCourts: recommendedCourts.map((c) => c.courtId),
          recommendedCourtsInfo: recommendedCourts,
          totalPrice,
          averagePrice: Math.round(totalPrice / requestedQuantity),
        });
      } else {
        unavailableTimeSlots.push({
          start: timeSlot.start,
          end: timeSlot.end,
          availableCourts: availableCourts.length,
          reason: `Chỉ có ${availableCourts.length} sân available, cần ${requestedQuantity} sân`,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        venueId,
        venueName: venue.name,
        date,
        requestedQuantity,
        sportType: sportType || "all",
        duration: durationHours,
        availableTimeSlots,
        unavailableTimeSlots: unavailableTimeSlots.slice(0, 5), // Limit response size
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk Court Availability Check
export const bulkCourtAvailabilityCheck = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { date, requests } = req.body;

    // Validate required parameters
    if (!date || !requests || !Array.isArray(requests)) {
      return res.status(400).json({
        success: false,
        message: "Date và requests array là bắt buộc",
      });
    }

    // Check if venue exists
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy venue",
      });
    }

    // Import Booking model
    const Booking = (await import("../models/booking.js")).default;

    // Get all bookings for the date
    const bookingDate = new Date(date);
    const bookings = await Booking.find({
      venue: venueId,
      date: bookingDate,
      status: { $in: ["reserved", "confirmed"] },
    }).populate("court", "name sportType pricing");

    // Filter active bookings
    const now = new Date();
    const activeBookings = bookings.filter((booking) => {
      if (booking.status === "confirmed") return true;
      if (booking.status === "reserved") {
        return new Date(booking.reservationExpiresAt) > now;
      }
      return false;
    });

    const results = [];

    // Process each request
    for (const request of requests) {
      const { timeSlot, courtQuantity, sportType } = request;

      if (!timeSlot || !courtQuantity) {
        results.push({
          timeSlot,
          requestedQuantity: courtQuantity,
          isAvailable: false,
          error: "TimeSlot và courtQuantity là bắt buộc",
        });
        continue;
      }

      // Build query for courts
      let courtQuery = {
        venueId: venueId,
        isActive: true,
      };

      if (sportType) {
        const sportVariations = sportTypeMapping[sportType.toLowerCase()] || [
          sportType,
        ];
        courtQuery.sportType = {
          $in: sportVariations.map((sport) => new RegExp(sport, "i")),
        };
      }

      // Get courts for this request
      const courts = await Court.find(courtQuery);
      const availableCourts = [];

      // Check availability for each court
      for (const court of courts) {
        const isConflicting = activeBookings.some((booking) => {
          if (booking.court._id.toString() !== court._id.toString())
            return false;
          return booking.timeSlots.some((bookingSlot) =>
            timeSlotsOverlap(timeSlot, bookingSlot)
          );
        });

        if (!isConflicting) {
          const pricing = getCourtPricing(court, timeSlot, date);
          availableCourts.push({
            courtId: court._id,
            courtName: court.name,
            price: pricing.pricePerHour * 2, // Assume 2 hours default
            pricePerHour: pricing.pricePerHour,
          });
        }
      }

      const isAvailable = availableCourts.length >= courtQuantity;

      if (isAvailable) {
        // Sort by price and get recommended courts
        availableCourts.sort((a, b) => a.price - b.price);
        const recommendedCourts = availableCourts.slice(0, courtQuantity);
        const totalPrice = recommendedCourts.reduce(
          (sum, court) => sum + court.price,
          0
        );

        results.push({
          timeSlot,
          requestedQuantity: courtQuantity,
          isAvailable: true,
          availableCourts: availableCourts.length,
          recommendedCourts: recommendedCourts.map((c) => c.courtId),
          recommendedCourtsInfo: recommendedCourts,
          totalPrice,
        });
      } else {
        results.push({
          timeSlot,
          requestedQuantity: courtQuantity,
          isAvailable: false,
          availableCourts: availableCourts.length,
          reason: `Chỉ có ${availableCourts.length} sân available, cần ${courtQuantity} sân`,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        venueId,
        venueName: venue.name,
        date,
        results,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Helper function to get court pricing for specific time slot
const getCourtPricing = (court, timeSlot, date) => {
  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const dayType = isWeekend ? "weekend" : "weekday";

  // Find matching pricing rule
  const pricingRule = court.pricing?.find(
    (p) =>
      p.dayType === dayType &&
      p.isActive &&
      p.timeSlot &&
      timeSlot.start >= p.timeSlot.start &&
      timeSlot.end <= p.timeSlot.end
  );

  // Fallback to first active pricing or default
  const fallbackPricing = court.pricing?.find((p) => p.isActive);

  return {
    pricePerHour:
      pricingRule?.pricePerHour || fallbackPricing?.pricePerHour || 200000,
    dayType,
  };
};

// Helper function to check if two time slots overlap
const timeSlotsOverlap = (slot1, slot2) => {
  const start1 = timeToMinutes(slot1.start);
  const end1 = timeToMinutes(slot1.end);
  const start2 = timeToMinutes(slot2.start);
  const end2 = timeToMinutes(slot2.end);

  return start1 < end2 && end1 > start2;
};

// Helper function to convert time string to minutes
const timeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};
