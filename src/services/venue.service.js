/**
 * @fileoverview Venue Service
 * @created 2025-01-15
 * @file venue.service.js
 * @description This service handles all venue-related business logic for the Vic Sports application.
 * It provides methods for creating, updating, deleting, and querying venues.
 */

import mongoose from "mongoose";
import Court from "../models/court.js";
import Venue from "../models/venue.js";
import logger from "../utils/logger.js";

export class VenueService {
  static async createVenue(venueData) {
    console.log('=== VENUE SERVICE START ===');
    console.log('Venue data received:', venueData);
    
    try {
      logger.info("Starting venue creation", { venueData });
      
      const {
        ownerId,
        name,
        description,
        address,
        contactInfo,
        amenities,
        operatingHours,
        parking,
        images
      } = venueData;

      console.log('Extracted data:', { 
        ownerId, 
        name, 
        hasAddress: !!address,
        hasContactInfo: !!contactInfo 
      });

      logger.info("Extracted venue data", { 
        ownerId, 
        name, 
        hasAddress: !!address,
        hasContactInfo: !!contactInfo 
      });

      // Validate required fields
      if (!ownerId || !name || !address || !address.street || !address.ward || !address.district || !address.city) {
        console.log('Missing required fields');
        logger.error("Missing required fields", { 
          ownerId: !!ownerId, 
          name: !!name, 
          address: !!address,
          street: address?.street,
          ward: address?.ward,
          district: address?.district,
          city: address?.city
        });
        throw new Error("Missing required fields");
      }

      // Validate coordinates
      if (!address.coordinates || !address.coordinates.lat || !address.coordinates.lng) {
        console.log('Missing coordinates');
        logger.error("Missing coordinates", { coordinates: address.coordinates });
        throw new Error("Address coordinates (lat, lng) are required");
      }

      // Convert coordinates to GeoJSON format
      const geoJsonCoordinates = {
        type: 'Point',
        coordinates: [address.coordinates.lng, address.coordinates.lat] // [longitude, latitude]
      };

      console.log('Creating venue object with GeoJSON coordinates');
      logger.info("Creating venue object", { 
        ownerId, 
        name, 
        address: address.street,
        coordinates: geoJsonCoordinates.coordinates
      });

      const venue = new Venue({
        ownerId,
        name,
        description,
        address: {
          ...address,
          coordinates: geoJsonCoordinates
        },
        contactInfo,
        amenities,
        operatingHours,
        parking,
        images
      });

      console.log('Saving venue to database');
      logger.info("Saving venue to database");
      await venue.save();

      console.log('Venue saved successfully:', venue._id);
      logger.info("Venue created successfully", { venueId: venue._id });
      return venue;
    } catch (error) {
      console.log('=== VENUE SERVICE ERROR ===');
      console.log('Error message:', error.message);
      console.log('Error name:', error.name);
      console.log('Error code:', error.code);
      console.log('Error stack:', error.stack);
      
      logger.error("Error creating venue", { 
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      });
      throw error;
    }
  }

  static async getAllVenues(queryParams = {}) {
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
      } = queryParams;

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

      logger.info("Venues retrieved successfully", { count: venues.length });
      return {
        venues,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalVenues: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        }
      };
    } catch (error) {
      logger.error("Error retrieving venues", { error: error.message });
      throw error;
    }
  }

  static async getVenueById(venueId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(venueId)) {
        throw new Error("Invalid venue ID");
      }

      const venue = await Venue.findById(venueId)
        .populate("ownerId", "fullName email phone");

      if (!venue) {
        throw new Error(`Venue not found with id of ${venueId}`);
      }

      logger.info("Venue retrieved successfully", { venueId: venue._id });
      return venue;
    } catch (error) {
      logger.error("Error retrieving venue by ID", { error: error.message });
      throw error;
    }
  }

  static async updateVenue(venueId, venueData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(venueId)) {
        throw new Error("Invalid venue ID");
      }

      const venue = await Venue.findById(venueId);
      if (!venue) {
        throw new Error(`Venue not found with id of ${venueId}`);
      }

      // Handle coordinates conversion if address.coordinates is provided
      if (venueData.address && venueData.address.coordinates) {
        const { lat, lng } = venueData.address.coordinates;
        if (lat !== undefined && lng !== undefined) {
          // Convert to GeoJSON format
          venueData.address.coordinates = {
            type: 'Point',
            coordinates: [lng, lat] // [longitude, latitude]
          };
        }
      }

      // Update venue fields
      Object.assign(venue, venueData);
      await venue.save();

      logger.info("Venue updated successfully", { venueId: venue._id });
      return venue;
    } catch (error) {
      logger.error("Error updating venue", { error: error.message });
      throw error;
    }
  }

  static async deleteVenue(venueId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(venueId)) {
        throw new Error("Invalid venue ID");
      }

      const venue = await Venue.findById(venueId);
      if (!venue) {
        throw new Error(`Venue not found with id of ${venueId}`);
      }

      venue.isActive = false;
      await venue.save();

      logger.info("Venue deleted successfully", { venueId: venue._id });
      return venue;
    } catch (error) {
      logger.error("Error deleting venue", { error: error.message });
      throw error;
    }
  }

  static async searchVenuesByLocation(searchParams) {
    try {
      const { lat, lng, radius = 10, sportType } = searchParams;

      if (!lat || !lng) {
        throw new Error("Latitude and longitude are required");
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

      logger.info("Venues searched by location successfully", { count: venues.length });
      return {
        venues,
        searchParams: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radius: parseInt(radius),
          sportType,
        }
      };
    } catch (error) {
      logger.error("Error searching venues by location", { error: error.message });
      throw error;
    }
  }

  static async getVenuesByOwner(ownerId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(ownerId)) {
        throw new Error("Invalid owner ID");
      }

      const venues = await Venue.find({ ownerId })
        .populate("ownerId", "fullName email")
        .sort({ createdAt: -1 });

      logger.info("Venues retrieved by owner successfully", { ownerId, count: venues.length });
      return venues;
    } catch (error) {
      logger.error("Error retrieving venues by owner", { error: error.message });
      throw error;
    }
  }

  static async getAvailableCities() {
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

      logger.info("Available cities retrieved successfully", { count: cities.length });
      return cities;
    } catch (error) {
      logger.error("Error retrieving available cities", { error: error.message });
      throw error;
    }
  }

  static async getDistrictsByCity(city) {
    try {
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

      logger.info("Districts retrieved by city successfully", { city, count: districts.length });
      return districts;
    } catch (error) {
      logger.error("Error retrieving districts by city", { error: error.message });
      throw error;
    }
  }

  static async getVenueStats(venueId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(venueId)) {
        throw new Error("Invalid venue ID");
      }

      const venue = await Venue.findById(venueId);
      if (!venue) {
        throw new Error(`Venue not found with id of ${venueId}`);
      }

      // Get court count
      const courtCount = await Court.countDocuments({ venueId, isActive: true });

      const stats = {
        totalBookings: venue.totalBookings,
        totalRevenue: venue.totalRevenue,
        averageRating: venue.ratings.average,
        totalReviews: venue.ratings.count,
        courtCount,
        isVerified: venue.isVerified,
        isActive: venue.isActive,
        createdAt: venue.createdAt,
      };

      logger.info("Venue stats retrieved successfully", { venueId });
      return stats;
    } catch (error) {
      logger.error("Error retrieving venue stats", { error: error.message });
      throw error;
    }
  }

  static async uploadVenueImages(venueId, images) {
    try {
      if (!mongoose.Types.ObjectId.isValid(venueId)) {
        throw new Error("Invalid venue ID");
      }

      const venue = await Venue.findById(venueId);
      if (!venue) {
        throw new Error(`Venue not found with id of ${venueId}`);
      }

      if (!images || !Array.isArray(images)) {
        throw new Error("Images array is required");
      }

      venue.images = [...(venue.images || []), ...images];
      await venue.save();

      logger.info("Venue images uploaded successfully", { venueId });
      return venue.images;
    } catch (error) {
      logger.error("Error uploading venue images", { error: error.message });
      throw error;
    }
  }

  static async removeVenueImage(venueId, imageIndex) {
    try {
      if (!mongoose.Types.ObjectId.isValid(venueId)) {
        throw new Error("Invalid venue ID");
      }

      const venue = await Venue.findById(venueId);
      if (!venue) {
        throw new Error(`Venue not found with id of ${venueId}`);
      }

      if (venue.images && venue.images[imageIndex]) {
        venue.images.splice(imageIndex, 1);
        await venue.save();
      }

      logger.info("Venue image removed successfully", { venueId });
      return venue.images;
    } catch (error) {
      logger.error("Error removing venue image", { error: error.message });
      throw error;
    }
  }
}
