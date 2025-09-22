import dotenv from 'dotenv';
import express from 'express';
import connectDB from './config/database.js';
import logger from './utils/logger.js';
import { corsMiddleware } from './config/cors.config.js';
import { errorHandler } from './middlewares/error.middleware.js';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(corsMiddleware);
app.use(morgan('dev'));
app.use(helmet());
app.use(compression());

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Vic Sports API' });
});

// Routes
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import adminRoutes from "./routes/admin.route.js";
import venueRoutes from "./routes/venue.route.js";
import courtRoutes from "./routes/court.route.js";
import bookingRoutes from "./routes/booking.route.js";
import reviewRoutes from "./routes/review.route.js";
import chatRoutes from "./routes/chat.route.js";
import coachRoutes from "./routes/coach.route.js";
import loyaltyRoutes from "./routes/loyalty.route.js";
import analyticsRoutes from "./routes/analytics.route.js";

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
app.use("/api/v1/analytics", analyticsRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Cho phép lắng nghe mọi địa chỉ mạng

app.listen(PORT, HOST, () => {
  logger.info(`Server is running on port ${PORT}`);
});

export default app;
