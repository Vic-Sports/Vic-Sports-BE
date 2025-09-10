import dotenv from 'dotenv';
import express from 'express';
import connectDB from './config/database.js';
import logger from './utils/logger.js';
import { corsMiddleware } from './config/cors.config.js';
import { errorHandler } from './middlewares/error.middleware.js';
import apiRoutes from './routes/api.js';
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
app.use('/api/v1', apiRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Cho phép lắng nghe mọi địa chỉ mạng

app.listen(PORT, HOST, () => {
  logger.info(`Server is running on port ${PORT}`);
});

export default app;
