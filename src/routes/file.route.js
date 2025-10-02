import express from "express";
import { uploadFile } from "../controllers/file.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.middleware.js";

const router = express.Router();

// Upload file endpoint
router.post("/upload", protect, upload.single("fileImg"), uploadFile);

export default router;
