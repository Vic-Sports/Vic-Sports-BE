import compression from "compression";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import morgan from "morgan";
import { Server } from "socket.io";
import { corsMiddleware } from "./config/cors.config.js";
import connectDB from "./config/database.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { initializeChatSocket } from "./socket/chat.socket.js";
import { scheduleBookingCleanup } from "./utils/bookingCleanup.js";
import { initializeCleanupJobs } from "./utils/cleanupJobs.js";
import logger from "./utils/logger.js";
import { initializeTournamentStatusJobs } from "./utils/tournamentStatusScheduler.js";

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();
const server = createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize chat socket handlers
initializeChatSocket(io);

// Import webhook middleware
import { captureRawBody } from "./middlewares/webhook.middleware.js";

// Webhook raw body capture - PHẢI ĐẶT TRƯỚC express.json()
app.use(captureRawBody);

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(corsMiddleware);
app.use(morgan("dev"));
app.use(helmet());
app.use(compression());

// Default route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Vic Sports API" });
});

// Routes
import adminRoutes from "./routes/admin.route.js";
import authRoutes from "./routes/auth.route.js";
import bookingRoutes from "./routes/booking.route.js";
import chatRoutes from "./routes/chat.route.js";
import coachRoutes from "./routes/coach.route.js";
import communityRoutes from "./routes/community.route.js";
import courtRoutes from "./routes/court.route.js";
import fileRoutes from "./routes/file.route.js";
import loyaltyRoutes from "./routes/loyalty.route.js";
import ownerRoutes from "./routes/owner.route.js";
import paymentRoutes from "./routes/payment.route.js";
import playerRoutes from "./routes/player.route.js";
import reviewRoutes from "./routes/review.route.js";
import sportsMatchingRoutes from "./routes/sportsMatching.route.js";
import tournamentRoutes from "./routes/tournament.route.js";
import userRoutes from "./routes/user.route.js";
import venueRoutes from "./routes/venue.route.js";
import webhookRoutes from "./routes/webhook.route.js";
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/venues", venueRoutes);
app.use("/api/v1/courts", courtRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/coaches", coachRoutes);
app.use("/api/v1/loyalty", loyaltyRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/webhooks", webhookRoutes);
app.use("/api/v1/owner", ownerRoutes);
app.use("/api/v1/file", fileRoutes);
app.use("/api/v1/tournaments", tournamentRoutes);
app.use("/api/v1/players", playerRoutes);
app.use("/api/v1/community", communityRoutes);
app.use("/api/v1/sports-matching", sportsMatchingRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0"; // Cho phép lắng nghe mọi địa chỉ mạng

server.listen(PORT, HOST, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Socket.IO server is running`);

  // Initialize cleanup jobs after server starts
  initializeCleanupJobs();

  // Schedule automatic booking cleanup
  scheduleBookingCleanup();

  // Initialize tournament status update jobs
  initializeTournamentStatusJobs();
});

export default app;
