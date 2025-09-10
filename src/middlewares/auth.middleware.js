import jwt from "jsonwebtoken";
import User from "../models/user.js";
import TokenBlacklist from "../models/tokenBlacklist.js";

// Protect routes - verify JWT token
export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header or cookie
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    // Check if token is blacklisted
    const isBlacklisted = await TokenBlacklist.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: "Token has been invalidated",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is active
    if (user.status !== "ACTIVE") {
      return res.status(401).json({
        success: false,
        message: "Account is not active",
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(401).json({
        success: false,
        message: "Account is blocked",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Authorize specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }

    next();
  };
};

// Optional auth - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const isBlacklisted = await TokenBlacklist.isTokenBlacklisted(token);
      if (!isBlacklisted) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(decoded.userId);
          if (user && user.status === "ACTIVE" && !user.isBlocked) {
            req.user = user;
          }
        } catch (error) {
          // Token is invalid, but we don't fail
        }
      }
    }

    next();
  } catch (error) {
    next();
  }
};

// Rate limiting middleware (basic implementation)
const rateLimitMap = new Map();

export const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    if (rateLimitMap.has(key)) {
      const requests = rateLimitMap.get(key).filter(time => time > windowStart);
      rateLimitMap.set(key, requests);
    } else {
      rateLimitMap.set(key, []);
    }

    const requests = rateLimitMap.get(key);

    if (requests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: "Too many requests, please try again later",
      });
    }

    requests.push(now);
    next();
  };
};

// Validate request body middleware
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    next();
  };
};

// Check if user owns resource
export const checkOwnership = (model, paramName = "id") => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      const resource = await model.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: "Resource not found",
        });
      }

      // Check if user owns the resource
      if (resource.ownerId && !resource.ownerId.equals(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this resource",
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
};

// Check if user is participant in chat
export const checkChatParticipation = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const Chat = (await import("../models/chat.js")).default;
    
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this chat",
      });
    }

    req.chat = chat;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Check if user can access booking
export const checkBookingAccess = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const Booking = (await import("../models/booking.js")).default;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user is customer, venue owner, or admin
    const isCustomer = booking.customerId.equals(req.user.id);
    const isAdmin = req.user.role === "admin";
    
    let isVenueOwner = false;
    if (!isCustomer && !isAdmin) {
      const Venue = (await import("../models/venue.js")).default;
      const venue = await Venue.findById(booking.venueId);
      isVenueOwner = venue && venue.ownerId.equals(req.user.id);
    }

    if (!isCustomer && !isAdmin && !isVenueOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this booking",
      });
    }

    req.booking = booking;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
