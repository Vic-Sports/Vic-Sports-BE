import cors from "cors";

const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "delay",
    "upload-type", // Thêm header upload-type
    "venue-id", // Thêm header venue-id
    "court-id", // Thêm header court-id
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

export const corsMiddleware = cors(corsOptions);
