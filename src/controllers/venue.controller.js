/**
 * @fileoverview Venue Controller
 * @created 2025-01-15
 * @file venue.controller.js
 * @description This controller handles all venue-related HTTP requests for the Vic Sports application.
 * It processes incoming requests, validates input data, and coordinates with the venue service
 * to perform venue operations. The controller is responsible for request/response handling
 * and error management.
 */

import { query, validationResult } from 'express-validator';
import { VenueService } from '../services/venue.service.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import logger from '../utils/logger.js';

export const venueQueryValidationRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Invalid page number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
  query('city').optional().trim().notEmpty().withMessage('Invalid city filter'),
  query('district').optional().trim().notEmpty().withMessage('Invalid district filter'),
  query('sportType').optional().trim().notEmpty().withMessage('Invalid sport type filter'),
  query('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Invalid rating filter'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1-100 characters'),
  query('sortBy')
    .optional()
    .isIn(['name', '-name', 'createdAt', '-createdAt', 'ratings.average', '-ratings.average', 'rating', '-rating'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Invalid sort order'),
];

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

// @desc    Create Venue
// @route   POST /api/venues
// @access Private (Owner)
export const createVenue = async (req, res, next) => {
  console.log('=== CREATE VENUE START ===');
  console.log('Request body:', req.body);
  console.log('Request user:', req.user);
  
  try {
    logger.info('Creating new venue', { 
      venueData: req.body,
      user: req.user ? { id: req.user.id, role: req.user.role } : null
    });
    
    console.log('Logger info called');
    
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      console.log('Authentication failed');
      logger.error('Authentication failed', { user: req.user });
      return next(new ErrorResponse('Authentication required', 401));
    }

    console.log('User authenticated:', req.user.id);

    const venueData = {
      ...req.body,
      ownerId: req.user.id,
    };

    console.log('Venue data prepared:', venueData);
    logger.info('Venue data prepared', { venueData });

    console.log('Calling VenueService.createVenue');
    const venue = await VenueService.createVenue(venueData);

    console.log('Venue created successfully:', venue._id);
    logger.info('Venue created successfully', { venueId: venue._id });

    res.status(201).json({
      success: true,
      message: "Venue created successfully",
      data: venue,
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    console.log('Error name:', error.name);
    console.log('Error code:', error.code);
    console.log('Error stack:', error.stack);
    
    logger.error('Error creating venue', { 
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      console.log('Validation error detected');
      logger.error('Validation error details', { 
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }))
      });
      return res.status(400).json({
        success: false,
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message,
        })),
      });
    }
    
    // Handle Mongoose duplicate key error
    if (error.code === 11000) {
      console.log('Duplicate key error detected');
      logger.error('Duplicate key error', { error: error.message });
      return res.status(400).json({
        success: false,
        message: "Duplicate field value entered",
      });
    }
    
    console.log('Calling next with ErrorResponse');
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get All Venues
// @route   GET /api/venues
// @access Public
export const getAllVenues = async (req, res, next) => {
  try {
    logger.info('Fetching all venues', { query: req.query });

    // Validate query parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const result = await VenueService.getAllVenues(req.query);

    logger.info('Venues fetched successfully', { count: result.venues.length });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error fetching venues', { error: error.message });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Venue by ID
// @route   GET /api/venues/:venueId
// @access Public
export const getVenueById = async (req, res, next) => {
  try {
    const venueId = req.params.venueId;
    logger.info('Fetching venue details', { venueId });

    const venue = await VenueService.getVenueById(venueId);

    logger.info('Venue details fetched successfully', { venueId });
    res.status(200).json({
      success: true,
      data: venue,
    });
  } catch (error) {
    logger.error('Error fetching venue details', { error: error.message });
    if (error.message.includes('not found')) {
      return next(new ErrorResponse(error.message, 404));
    }
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Update Venue
// @route   PUT /api/venues/:venueId
// @access Private (Owner)
export const updateVenue = async (req, res, next) => {
  try {
    const venueId = req.params.venueId;
    const ownerId = req.user.id;
    logger.info('Updating venue', { venueId, updateData: req.body });

    // Check if user is the owner
    const venue = await VenueService.getVenueById(venueId);
    if (!venue.ownerId.equals(ownerId)) {
      return next(new ErrorResponse('Not authorized to update this venue', 403));
    }

    const updatedVenue = await VenueService.updateVenue(venueId, req.body);

    logger.info('Venue updated successfully', { venueId });
    res.status(200).json({
      success: true,
      message: "Venue updated successfully",
      data: updatedVenue,
    });
  } catch (error) {
    logger.error('Error updating venue', { error: error.message });
    if (error.message.includes('not found')) {
      return next(new ErrorResponse(error.message, 404));
    }
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Delete Venue
// @route   DELETE /api/venues/:venueId
// @access Private (Owner)
export const deleteVenue = async (req, res, next) => {
  try {
    const venueId = req.params.venueId;
    const ownerId = req.user.id;
    logger.info('Deleting venue', { venueId });

    // Check if user is the owner
    const venue = await VenueService.getVenueById(venueId);
    if (!venue.ownerId.equals(ownerId)) {
      return next(new ErrorResponse('Not authorized to delete this venue', 403));
    }

    const deletedVenue = await VenueService.deleteVenue(venueId);

    logger.info('Venue deleted successfully', { venueId });
    res.status(200).json({
      success: true,
      message: "Venue deleted successfully",
      data: deletedVenue,
    });
  } catch (error) {
    logger.error('Error deleting venue', { error: error.message });
    if (error.message.includes('not found')) {
      return next(new ErrorResponse(error.message, 404));
    }
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Upload Venue Images
// @route   POST /api/venues/:venueId/images
// @access Private (Owner)
export const uploadVenueImages = async (req, res, next) => {
  try {
    const venueId = req.params.venueId;
    const ownerId = req.user.id;
    const { images } = req.body;
    logger.info('Uploading venue images', { venueId });

    // Check if user is the owner
    const venue = await VenueService.getVenueById(venueId);
    if (!venue.ownerId.equals(ownerId)) {
      return next(new ErrorResponse('Not authorized to update this venue', 403));
    }

    const updatedImages = await VenueService.uploadVenueImages(venueId, images);

    logger.info('Venue images uploaded successfully', { venueId });
    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: {
        images: updatedImages,
      },
    });
  } catch (error) {
    logger.error('Error uploading venue images', { error: error.message });
    if (error.message.includes('not found')) {
      return next(new ErrorResponse(error.message, 404));
    }
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Remove Venue Image
// @route   DELETE /api/venues/:venueId/images/:imageIndex
// @access Private (Owner)
export const removeVenueImage = async (req, res, next) => {
  try {
    const venueId = req.params.venueId;
    const imageIndex = req.params.imageIndex;
    const ownerId = req.user.id;
    logger.info('Removing venue image', { venueId, imageIndex });

    // Check if user is the owner
    const venue = await VenueService.getVenueById(venueId);
    if (!venue.ownerId.equals(ownerId)) {
      return next(new ErrorResponse('Not authorized to update this venue', 403));
    }

    const updatedImages = await VenueService.removeVenueImage(venueId, imageIndex);

    logger.info('Venue image removed successfully', { venueId });
    res.status(200).json({
      success: true,
      message: "Image removed successfully",
      data: {
        images: updatedImages,
      },
    });
  } catch (error) {
    logger.error('Error removing venue image', { error: error.message });
    if (error.message.includes('not found')) {
      return next(new ErrorResponse(error.message, 404));
    }
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Venue Stats
// @route   GET /api/venues/:venueId/stats
// @access Private (Owner)
export const getVenueStats = async (req, res, next) => {
  try {
    const venueId = req.params.venueId;
    const ownerId = req.user.id;
    logger.info('Fetching venue stats', { venueId });

    // Check if user is the owner
    const venue = await VenueService.getVenueById(venueId);
    if (!venue.ownerId.equals(ownerId)) {
      return next(new ErrorResponse('Not authorized to view this venue\'s stats', 403));
    }

    const stats = await VenueService.getVenueStats(venueId);

    logger.info('Venue stats fetched successfully', { venueId });
    res.status(200).json({
      success: true,
      data: {
        stats,
      },
    });
  } catch (error) {
    logger.error('Error fetching venue stats', { error: error.message });
    if (error.message.includes('not found')) {
      return next(new ErrorResponse(error.message, 404));
    }
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Search Venues by Location
// @route   GET /api/venues/search/location
// @access Public
export const searchVenuesByLocation = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10, sportType } = req.query;
    logger.info('Searching venues by location', { lat, lng, radius, sportType });

    if (!lat || !lng) {
      return next(new ErrorResponse('Latitude and longitude are required', 400));
    }

    const result = await VenueService.searchVenuesByLocation({ lat, lng, radius, sportType });

    logger.info('Venues searched by location successfully', { count: result.venues.length });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error searching venues by location', { error: error.message });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Venues by Owner
// @route   GET /api/venues/owner/:ownerId
// @access Private (Owner)
export const getVenuesByOwner = async (req, res, next) => {
  try {
    const { ownerId } = req.params;
    const currentUserId = req.user.id;
    logger.info('Fetching venues by owner', { ownerId });

    // Check if user is requesting their own venues or is admin
    if (ownerId !== currentUserId && req.user.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to view these venues', 403));
    }

    const venues = await VenueService.getVenuesByOwner(ownerId);

    logger.info('Venues fetched by owner successfully', { ownerId, count: venues.length });
    res.status(200).json({
      success: true,
      data: {
        venues,
      },
    });
  } catch (error) {
    logger.error('Error fetching venues by owner', { error: error.message });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Available Cities
// @route   GET /api/venues/cities
// @access Public
export const getAvailableCities = async (req, res, next) => {
  try {
    logger.info('Fetching available cities');

    const cities = await VenueService.getAvailableCities();

    logger.info('Available cities fetched successfully', { count: cities.length });
    res.status(200).json({
      success: true,
      data: cities, // Return cities array directly, not wrapped in object
    });
  } catch (error) {
    logger.error('Error fetching available cities', { error: error.message });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Districts by City
// @route   GET /api/venues/districts/:city
// @access Public
export const getDistrictsByCity = async (req, res, next) => {
  try {
    const { city } = req.params;
    logger.info('Fetching districts by city', { city });

    const districts = await VenueService.getDistrictsByCity(city);

    logger.info('Districts fetched by city successfully', { city, count: districts.length });
    res.status(200).json({
      success: true,
      data: districts, // Return districts array directly, not wrapped in object
    });
  } catch (error) {
    logger.error('Error fetching districts by city', { error: error.message });
    next(new ErrorResponse(error.message, 500));
  }
};
