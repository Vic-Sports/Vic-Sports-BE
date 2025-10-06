import cors from "cors";

const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:5174", // Allow port 5174
    "http://localhost:5175", // Allow port 5175
  ],
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
