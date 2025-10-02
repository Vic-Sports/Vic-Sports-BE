import express from "express";

/**
 * Middleware để capture raw body cho webhook PayOS
 * PayOS cần raw body để verify signature
 */
export const captureRawBody = (req, res, next) => {
  if (req.originalUrl?.includes("/webhooks/payos")) {
    let data = "";
    req.setEncoding("utf8");

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      req.rawBody = data;
      try {
        req.body = JSON.parse(data);
      } catch (err) {
        console.error("Error parsing webhook body:", err);
        req.body = {};
      }
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
