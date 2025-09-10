import Venue from "../models/venue.js";
import Court from "../models/court.js";
import Location from "../models/location.js";

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
    if (!name || !address || !address.street || !address.ward || !address.district || !address.city) {
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
      const courts = await Court.find({ sportType, isActive: true }).select("venueId");
      const venueIds = courts.map(court => court.venueId);
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
        model: "Court",
        match: { isActive: true },
      });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    res.status(200).json({
      success: true,
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
    Object.keys(updateData).forEach(key => {
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
      const courts = await Court.find({ sportType, isActive: true }).select("venueId");
      const venueIds = courts.map(court => court.venueId);
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
