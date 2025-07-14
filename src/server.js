import dotenv from 'dotenv';
import express from 'express';
import connectDB from './config/database.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT;

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

export default app;
