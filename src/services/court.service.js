import Court from "../models/court.js";
import Venue from "../models/venue.js";
import logger from "../utils/logger.js";

export class CourtService {
  static async createCourt(courtData) {
    try {
      console.log('=== COURT SERVICE CREATE START ===');
      console.log('Court data:', courtData);
      
      logger.info('Creating new court', { courtData });

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
      } = courtData;

      // Validate required fields
      if (!venueId || !name || !sportType || !capacity) {
        throw new Error("Venue ID, name, sport type, and capacity are required");
      }

      // Check if venue exists
      const venue = await Venue.findById(venueId);
      if (!venue) {
        throw new Error("Venue not found");
      }

      const court = new Court({
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

      await court.save();
      
      console.log('=== COURT CREATED SUCCESSFULLY ===');
      logger.info('Court created successfully', { courtId: court._id, venueId });
      
      return court;
    } catch (error) {
      console.log('=== COURT SERVICE CREATE ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error creating court", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getAllCourts(queryParams) {
    try {
      console.log('=== COURT SERVICE GET ALL START ===');
      console.log('Query params:', queryParams);
      
      logger.info('Getting all courts', { queryParams });

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
      } = queryParams;

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

      console.log('=== COURTS RETRIEVED SUCCESSFULLY ===');
      logger.info('Courts retrieved successfully', { count: courts.length, total });

      return {
        courts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCourts: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.log('=== COURT SERVICE GET ALL ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error getting all courts", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getCourtById(courtId) {
    try {
      console.log('=== COURT SERVICE GET BY ID START ===');
      console.log('Court ID:', courtId);
      
      logger.info('Getting court by ID', { courtId });

      const court = await Court.findById(courtId)
        .populate("venueId", "name address contactInfo amenities");

      if (!court) {
        throw new Error("Court not found");
      }

      console.log('=== COURT RETRIEVED SUCCESSFULLY ===');
      logger.info('Court retrieved successfully', { courtId });

      return court;
    } catch (error) {
      console.log('=== COURT SERVICE GET BY ID ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error getting court by ID", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async updateCourt(courtId, courtData, ownerId) {
    try {
      console.log('=== COURT SERVICE UPDATE START ===');
      console.log('Court ID:', courtId);
      console.log('Update data:', courtData);
      console.log('Owner ID:', ownerId);
      
      logger.info('Updating court', { courtId, courtData, ownerId });

      const court = await Court.findById(courtId).populate("venueId");
      if (!court) {
        throw new Error("Court not found");
      }

      // Check if user is the venue owner
      if (!court.venueId.ownerId.equals(ownerId)) {
        throw new Error("Not authorized to update this court");
      }

      // Update court
      Object.keys(courtData).forEach(key => {
        if (courtData[key] !== undefined) {
          court[key] = courtData[key];
        }
      });

      await court.save();

      console.log('=== COURT UPDATED SUCCESSFULLY ===');
      logger.info('Court updated successfully', { courtId });

      return court;
    } catch (error) {
      console.log('=== COURT SERVICE UPDATE ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error updating court", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async deleteCourt(courtId, ownerId) {
    try {
      console.log('=== COURT SERVICE DELETE START ===');
      console.log('Court ID:', courtId);
      console.log('Owner ID:', ownerId);
      
      logger.info('Deleting court', { courtId, ownerId });

      const court = await Court.findById(courtId).populate("venueId");
      if (!court) {
        throw new Error("Court not found");
      }

      // Check if user is the venue owner
      if (!court.venueId.ownerId.equals(ownerId)) {
        throw new Error("Not authorized to delete this court");
      }

      court.isActive = false;
      await court.save();

      console.log('=== COURT DELETED SUCCESSFULLY ===');
      logger.info('Court deleted successfully', { courtId });

      return { message: "Court deleted successfully" };
    } catch (error) {
      console.log('=== COURT SERVICE DELETE ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error deleting court", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getCourtsByVenue(venueId) {
    try {
      console.log('=== COURT SERVICE GET BY VENUE START ===');
      console.log('Venue ID:', venueId);
      
      logger.info('Getting courts by venue', { venueId });

      const courts = await Court.find({ venueId, isActive: true })
        .populate("venueId", "name address");

      console.log('=== COURTS BY VENUE RETRIEVED SUCCESSFULLY ===');
      logger.info('Courts by venue retrieved successfully', { venueId, count: courts.length });

      return courts;
    } catch (error) {
      console.log('=== COURT SERVICE GET BY VENUE ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error getting courts by venue", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getCourtsBySport(sportType, queryParams) {
    try {
      console.log('=== COURT SERVICE GET BY SPORT START ===');
      console.log('Sport type:', sportType);
      console.log('Query params:', queryParams);
      
      logger.info('Getting courts by sport', { sportType, queryParams });

      const { page = 1, limit = 10, city, district } = queryParams;

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

      console.log('=== COURTS BY SPORT RETRIEVED SUCCESSFULLY ===');
      logger.info('Courts by sport retrieved successfully', { sportType, count: courts.length, total });

      return {
        courts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCourts: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.log('=== COURT SERVICE GET BY SPORT ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error getting courts by sport", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async checkCourtAvailability(courtId, queryParams) {
    try {
      console.log('=== COURT SERVICE CHECK AVAILABILITY START ===');
      console.log('Court ID:', courtId);
      console.log('Query params:', queryParams);
      
      logger.info('Checking court availability', { courtId, queryParams });

      const { date, startTime, endTime } = queryParams;

      if (!date) {
        throw new Error("Date is required");
      }

      const court = await Court.findById(courtId);
      if (!court) {
        throw new Error("Court not found");
      }

      // Get day of week (0 = Sunday, 1 = Monday, etc.)
      const requestedDate = new Date(date);
      const dayOfWeek = requestedDate.getDay();

      // Find default availability for this day
      const dayAvailability = court.defaultAvailability.find(
        day => day.dayOfWeek === dayOfWeek
      );

      if (!dayAvailability) {
        return {
          available: false,
          reason: "Court not available on this day",
          timeSlots: [],
          courtInfo: {
            name: court.name,
            sportType: court.sportType,
            capacity: court.capacity,
          },
        };
      }

      // Filter time slots based on requested time range
      let availableSlots = dayAvailability.timeSlots.filter(slot => slot.isAvailable);

      if (startTime && endTime) {
        availableSlots = availableSlots.filter(slot => {
          return slot.start >= startTime && slot.end <= endTime;
        });
      }

      console.log('=== COURT AVAILABILITY CHECKED SUCCESSFULLY ===');
      logger.info('Court availability checked successfully', { courtId, available: availableSlots.length > 0 });

      return {
        available: availableSlots.length > 0,
        timeSlots: availableSlots,
        courtInfo: {
          name: court.name,
          sportType: court.sportType,
          capacity: court.capacity,
        },
      };
    } catch (error) {
      console.log('=== COURT SERVICE CHECK AVAILABILITY ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error checking court availability", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getCourtPricing(courtId, queryParams) {
    try {
      console.log('=== COURT SERVICE GET PRICING START ===');
      console.log('Court ID:', courtId);
      console.log('Query params:', queryParams);
      
      logger.info('Getting court pricing', { courtId, queryParams });

      const { date, timeSlot } = queryParams;

      const court = await Court.findById(courtId);
      if (!court) {
        throw new Error("Court not found");
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

      console.log('=== COURT PRICING RETRIEVED SUCCESSFULLY ===');
      logger.info('Court pricing retrieved successfully', { courtId, dayType });

      return {
        pricing: applicablePricing,
        dayType,
        courtInfo: {
          name: court.name,
          sportType: court.sportType,
        },
      };
    } catch (error) {
      console.log('=== COURT SERVICE GET PRICING ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error getting court pricing", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async uploadCourtImages(courtId, images, ownerId) {
    try {
      console.log('=== COURT SERVICE UPLOAD IMAGES START ===');
      console.log('Court ID:', courtId);
      console.log('Images:', images);
      console.log('Owner ID:', ownerId);
      
      logger.info('Uploading court images', { courtId, imagesCount: images.length, ownerId });

      if (!images || !Array.isArray(images)) {
        throw new Error("Images array is required");
      }

      const court = await Court.findById(courtId).populate("venueId");
      if (!court) {
        throw new Error("Court not found");
      }

      // Check if user is the venue owner
      if (!court.venueId.ownerId.equals(ownerId)) {
        throw new Error("Not authorized to update this court");
      }

      court.images = [...(court.images || []), ...images];
      await court.save();

      console.log('=== COURT IMAGES UPLOADED SUCCESSFULLY ===');
      logger.info('Court images uploaded successfully', { courtId });

      return court.images;
    } catch (error) {
      console.log('=== COURT SERVICE UPLOAD IMAGES ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error uploading court images", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getAvailableSports() {
    try {
      console.log('=== COURT SERVICE GET AVAILABLE SPORTS START ===');
      
      logger.info('Getting available sports');

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

      console.log('=== AVAILABLE SPORTS RETRIEVED SUCCESSFULLY ===');
      logger.info('Available sports retrieved successfully', { count: sports.length });

      return sports;
    } catch (error) {
      console.log('=== COURT SERVICE GET AVAILABLE SPORTS ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error getting available sports", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async getCourtStats(courtId, ownerId) {
    try {
      console.log('=== COURT SERVICE GET STATS START ===');
      console.log('Court ID:', courtId);
      console.log('Owner ID:', ownerId);
      
      logger.info('Getting court stats', { courtId, ownerId });

      const court = await Court.findById(courtId).populate("venueId");
      if (!court) {
        throw new Error("Court not found");
      }

      // Check if user is the venue owner
      if (!court.venueId.ownerId.equals(ownerId)) {
        throw new Error("Not authorized to view this court's stats");
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

      console.log('=== COURT STATS RETRIEVED SUCCESSFULLY ===');
      logger.info('Court stats retrieved successfully', { courtId });

      return stats;
    } catch (error) {
      console.log('=== COURT SERVICE GET STATS ERROR ===');
      console.log('Error:', error.message);
      logger.error("Error getting court stats", { error: error.message, stack: error.stack });
      throw error;
    }
  }
}
