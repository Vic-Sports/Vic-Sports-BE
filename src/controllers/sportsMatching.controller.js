import User from "../models/user.js";

// Danh sách môn thể thao cố định khớp với frontend
const SPORTS_OPTIONS = [
  { value: "football", label: "Bóng đá" },
  { value: "tennis", label: "Tennis" },
  { value: "badminton", label: "Cầu lông" },
  { value: "basketball", label: "Bóng rổ" },
  { value: "volleyball", label: "Bóng chuyền" },
  { value: "table-tennis", label: "Bóng bàn" }
];

/**
 * Lấy danh sách môn thể thao cố định
 */
export const getSportsOptions = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: { sports: SPORTS_OPTIONS }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tìm kiếm người chơi theo sở thích thể thao
 */
export const findPlayersBySports = async (req, res, next) => {
  try {
    const { sports, limit = 10, page = 1 } = req.query;
    const userId = req.user._id;

    // Lấy thông tin user hiện tại
    const currentUser = await User.findById(userId).select("favoriteSports role");
    
    let players = [];
    let sportsArray = [];

    if (sports && sports !== '') {
      // Nếu có sports parameter, sử dụng nó
      sportsArray = Array.isArray(sports) ? sports : sports.split(',');
    } else if (currentUser.favoriteSports && currentUser.favoriteSports.length > 0) {
      // Nếu không có sports parameter nhưng user có môn yêu thích, sử dụng môn yêu thích
      sportsArray = currentUser.favoriteSports;
    } else {
      // Nếu không có sports parameter và user không có môn yêu thích, lấy ngẫu nhiên 3 customer
      players = await User.find({
        _id: { $ne: userId },
        role: "customer",
        status: "ACTIVE",
        isBlocked: false
      })
      .select("fullName avatar favoriteSports level tier rewardPoints lastSeen")
      .limit(3)
      .lean();

      // Thêm thông tin cho random players
      const randomPlayers = players.map(player => ({
        ...player,
        commonSportsCount: 0,
        commonSports: [],
        matchPercentage: 0
      }));

      return res.status(200).json({
        success: true,
        data: {
          players: randomPlayers,
          totalCount: randomPlayers.length,
          currentPage: parseInt(page),
          totalPages: 1,
          isRandom: true,
          message: "No favorite sports found, showing random players"
        }
      });
    }

    // Tìm người chơi có cùng sở thích thể thao (loại trừ chính mình)
    players = await User.find({
      _id: { $ne: userId },
      favoriteSports: { $in: sportsArray },
      status: "ACTIVE",
      isBlocked: false
    })
    .select("fullName avatar favoriteSports level tier rewardPoints lastSeen")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

    // Thêm thông tin về số môn thể thao chung
    const playersWithCommonSports = players.map(player => {
      const commonSports = player.favoriteSports.filter(sport => 
        sportsArray.includes(sport)
      );
      
      return {
        ...player,
        commonSportsCount: commonSports.length,
        commonSports: commonSports,
        matchPercentage: Math.round((commonSports.length / sportsArray.length) * 100)
      };
    });

    // Sắp xếp theo độ tương đồng cao nhất
    playersWithCommonSports.sort((a, b) => b.matchPercentage - a.matchPercentage);

    res.status(200).json({
      success: true,
      data: {
        players: playersWithCommonSports,
        totalCount: playersWithCommonSports.length,
        currentPage: parseInt(page),
        totalPages: Math.ceil(playersWithCommonSports.length / limit),
        isRandom: false,
        currentUserSports: currentUser.favoriteSports || []
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách tất cả môn thể thao phổ biến
 */
export const getPopularSports = async (req, res, next) => {
  try {
    // Lấy số lượng người chơi cho mỗi môn thể thao
    const sportsWithCount = await Promise.all(
      SPORTS_OPTIONS.map(async (sport) => {
        const count = await User.countDocuments({
          favoriteSports: sport.value,
          status: "ACTIVE",
          isBlocked: false
        });
        
        return {
          _id: sport.value,
          label: sport.label,
          count: count,
          players: [] // Có thể thêm danh sách players nếu cần
        };
      })
    );

    // Sắp xếp theo số lượng giảm dần
    sportsWithCount.sort((a, b) => b.count - a.count);

    res.status(200).json({
      success: true,
      data: { sports: sportsWithCount }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thông tin user hiện tại
 */
export const getCurrentUserInfo = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("fullName avatar favoriteSports role");

    res.status(200).json({
      success: true,
      data: { 
        user: {
          _id: user._id,
          fullName: user.fullName,
          avatar: user.avatar,
          favoriteSports: user.favoriteSports || [],
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
