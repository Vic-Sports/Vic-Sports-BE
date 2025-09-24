import { query, validationResult } from "express-validator";
import { CourtService } from "../services/court.service.js";
import { ErrorResponse } from "../utils/errorResponse.js";
import logger from "../utils/logger.js";

// Validation rules for court queries
export const courtQueryValidationRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Invalid page number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
  query('venueId').optional().isMongoId().withMessage('Invalid venue ID'),
  query('sportType').optional().isString().withMessage('Invalid sport type'),
  query('search').optional().isString().withMessage('Invalid search term'),
  query('sortBy').optional().isIn(['createdAt', 'name', 'ratings.average', 'totalBookings']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order'),
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

// @desc    Create Court
// @route   POST /api/courts
// @access Private (Owner)
export const createCourt = async (req, res, next) => {
  console.log('=== CREATE COURT START ===');
  console.log('Request body:', req.body);
  console.log('Request user:', req.user);
  try {
    logger.info('Creating new court', { courtData: req.body, user: req.user ? { id: req.user.id, role: req.user.role } : null });
    
    const court = await CourtService.createCourt(req.body);
    
    res.status(201).json({
      success: true,
      message: "Court created successfully",
      data: court,
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    logger.error('Error creating court', { error: error.message, stack: error.stack, name: error.name, code: error.code });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get All Courts
// @route   GET /api/courts
// @access Public
export const getAllCourts = async (req, res, next) => {
  console.log('=== GET ALL COURTS START ===');
  console.log('Query params:', req.query);
  try {
    logger.info('Getting all courts', { queryParams: req.query });
    
    const result = await CourtService.getAllCourts(req.query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error getting all courts', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Court by ID
// @route   GET /api/courts/:courtId
// @access Public
export const getCourtById = async (req, res, next) => {
  console.log('=== GET COURT BY ID START ===');
  console.log('Court ID:', req.params.courtId);
  try {
    logger.info('Getting court by ID', { courtId: req.params.courtId });
    
    const court = await CourtService.getCourtById(req.params.courtId);
    
    res.status(200).json({
      success: true,
      data: { court },
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error getting court by ID', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Update Court
// @route   PUT /api/courts/:courtId
// @access Private (Owner)
export const updateCourt = async (req, res, next) => {
  console.log('=== UPDATE COURT START ===');
  console.log('Court ID:', req.params.courtId);
  console.log('Update data:', req.body);
  console.log('User:', req.user);
  try {
    logger.info('Updating court', { courtId: req.params.courtId, updateData: req.body, user: req.user });
    
    const court = await CourtService.updateCourt(req.params.courtId, req.body, req.user.id);
    
    res.status(200).json({
      success: true,
      message: "Court updated successfully",
      data: { court },
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error updating court', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Delete Court
// @route   DELETE /api/courts/:courtId
// @access Private (Owner)
export const deleteCourt = async (req, res, next) => {
  console.log('=== DELETE COURT START ===');
  console.log('Court ID:', req.params.courtId);
  console.log('User:', req.user);
  try {
    logger.info('Deleting court', { courtId: req.params.courtId, user: req.user });
    
    const result = await CourtService.deleteCourt(req.params.courtId, req.user.id);
    
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error deleting court', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Courts by Venue
// @route   GET /api/courts/venue/:venueId
// @access Public
export const getCourtsByVenue = async (req, res, next) => {
  console.log('=== GET COURTS BY VENUE START ===');
  console.log('Venue ID:', req.params.venueId);
  try {
    logger.info('Getting courts by venue', { venueId: req.params.venueId });
    
    const courts = await CourtService.getCourtsByVenue(req.params.venueId);
    
    res.status(200).json({
      success: true,
      data: { courts },
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error getting courts by venue', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Courts by Sport Type
// @route   GET /api/courts/sport/:sportType
// @access Public
export const getCourtsBySport = async (req, res, next) => {
  console.log('=== GET COURTS BY SPORT START ===');
  console.log('Sport type:', req.params.sportType);
  console.log('Query params:', req.query);
  try {
    logger.info('Getting courts by sport', { sportType: req.params.sportType, queryParams: req.query });
    
    const result = await CourtService.getCourtsBySport(req.params.sportType, req.query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error getting courts by sport', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Check Court Availability
// @route   GET /api/courts/:courtId/availability
// @access Public
export const checkCourtAvailability = async (req, res, next) => {
  console.log('=== CHECK COURT AVAILABILITY START ===');
  console.log('Court ID:', req.params.courtId);
  console.log('Query params:', req.query);
  try {
    logger.info('Checking court availability', { courtId: req.params.courtId, queryParams: req.query });
    
    const result = await CourtService.checkCourtAvailability(req.params.courtId, req.query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error checking court availability', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Court Pricing
// @route   GET /api/courts/:courtId/pricing
// @access Public
export const getCourtPricing = async (req, res, next) => {
  console.log('=== GET COURT PRICING START ===');
  console.log('Court ID:', req.params.courtId);
  console.log('Query params:', req.query);
  try {
    logger.info('Getting court pricing', { courtId: req.params.courtId, queryParams: req.query });
    
    const result = await CourtService.getCourtPricing(req.params.courtId, req.query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error getting court pricing', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Upload Court Images
// @route   POST /api/courts/:courtId/images
// @access Private (Owner)
export const uploadCourtImages = async (req, res, next) => {
  console.log('=== UPLOAD COURT IMAGES START ===');
  console.log('Court ID:', req.params.courtId);
  console.log('Images:', req.body.images);
  console.log('User:', req.user);
  try {
    logger.info('Uploading court images', { courtId: req.params.courtId, images: req.body.images, user: req.user });
    
    const images = await CourtService.uploadCourtImages(req.params.courtId, req.body.images, req.user.id);
    
    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: { images },
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error uploading court images', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Available Sport Types
// @route   GET /api/courts/sports
// @access Public
export const getAvailableSports = async (req, res, next) => {
  console.log('=== GET AVAILABLE SPORTS START ===');
  try {
    logger.info('Getting available sports');
    
    const sports = await CourtService.getAvailableSports();
    
    res.status(200).json({
      success: true,
      data: { sports },
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error getting available sports', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};

// @desc    Get Court Stats
// @route   GET /api/courts/:courtId/stats
// @access Private (Owner)
export const getCourtStats = async (req, res, next) => {
  console.log('=== GET COURT STATS START ===');
  console.log('Court ID:', req.params.courtId);
  console.log('User:', req.user);
  try {
    logger.info('Getting court stats', { courtId: req.params.courtId, user: req.user });
    
    const stats = await CourtService.getCourtStats(req.params.courtId, req.user.id);
    
    res.status(200).json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.log('=== ERROR CAUGHT ===');
    console.log('Error message:', error.message);
    logger.error('Error getting court stats', { error: error.message, stack: error.stack });
    next(new ErrorResponse(error.message, 500));
  }
};
