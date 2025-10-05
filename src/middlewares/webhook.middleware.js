import express from "express";
import getRawBody from "raw-body";

/**
 * Middleware để capture raw body cho webhook PayOS
 * PayOS cần raw body để verify signature
 */
export const captureRawBody = (req, res, next) => {
  if (req.originalUrl?.includes("/webhooks/payos")) {
    // Use raw-body to safely read the raw request body buffer
    getRawBody(req, {
      length: req.headers["content-length"],
      limit: "1mb",
      encoding: true,
    })
      .then((buf) => {
        // Save raw body (string) and parsed body, and mark as parsed so body-parser skips this request
        req.rawBody = buf.toString();
        try {
          req.body = JSON.parse(req.rawBody);
        } catch (err) {
          console.error("Error parsing webhook body:", err);
          req.body = {};
        }
        // Indicate body has already been parsed to prevent downstream body-parser from attempting to read the stream again
        req._body = true;
        next();
      })
      .catch((err) => {
        console.error("Failed to read webhook raw body:", err);
        // fallback to empty body
        req.rawBody = null;
        req.body = {};
        req._body = true;
        next();
      });
  } else {
    next();
  }
};

/**
 * Middleware setup cho webhook endpoints
 */
export const webhookBodyParser = express.raw({ type: "application/json" });
