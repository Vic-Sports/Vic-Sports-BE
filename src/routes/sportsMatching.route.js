import express from "express";
import {
    findPlayersBySports,
    getCurrentUserInfo,
    getPopularSports,
    getSportsOptions
} from "../controllers/sportsMatching.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(protect);

// Lấy danh sách môn thể thao cố định
router.get("/sports-options", getSportsOptions);

// Lấy thông tin user hiện tại
router.get("/current-user", getCurrentUserInfo);

// Tìm kiếm người chơi theo sở thích thể thao
router.get("/find-players", findPlayersBySports);

// Lấy danh sách môn thể thao phổ biến
router.get("/popular-sports", getPopularSports);

export default router;