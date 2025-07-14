import jwt from "jsonwebtoken";
import logger from "./logger.js";

export const generateToken = (payload, expiresIn) => {
  try {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || "1d",
    });
  } catch (error) {
    logger.error("Error generating token", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    logger.error("Error verifying token", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

export const generateRefreshToken = (payload) => {
  try {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    });
  } catch (error) {
    logger.error("Error generating refresh token", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    logger.error("Error verifying refresh token", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};
