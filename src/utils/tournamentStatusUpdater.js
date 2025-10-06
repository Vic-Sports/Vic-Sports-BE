import Tournament from "../models/tournament.js";

/**
 * Cập nhật trạng thái tournament dựa trên thời gian
 * @param {Object} tournament - Tournament object
 * @returns {string} - Status mới
 */
export const calculateTournamentStatus = (tournament) => {
  const now = new Date();
  const regStart = new Date(tournament.registrationStartDate);
  const regEnd = new Date(tournament.registrationEndDate);
  const start = new Date(tournament.startDate);
  const end = new Date(tournament.endDate);

  // Nếu tournament đã bị hủy hoặc hoàn thành, không thay đổi
  if (tournament.status === "cancelled" || tournament.status === "completed") {
    return tournament.status;
  }

  // Nếu chưa đến thời gian mở đăng ký
  if (now < regStart) {
    return "upcoming";
  }

  // Nếu đang trong thời gian mở đăng ký
  if (now >= regStart && now <= regEnd) {
    return "registration_open";
  }

  // Nếu đã đóng đăng ký nhưng chưa bắt đầu (SẮP DIỄN RA)
  if (now > regEnd && now < start) {
    return "about_to_start";
  }

  // Nếu đang trong thời gian diễn ra (ĐANG DIỄN RA)
  if (now >= start && now <= end) {
    return "ongoing";
  }

  // Nếu đã kết thúc (ĐÃ KẾT THÚC)
  if (now > end) {
    return "completed";
  }

  return tournament.status;
};

/**
 * Cập nhật trạng thái cho một tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<Object>} - Tournament đã cập nhật
 */
export const updateTournamentStatus = async (tournamentId) => {
  try {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const newStatus = calculateTournamentStatus(tournament);
    
    if (newStatus !== tournament.status) {
      tournament.status = newStatus;
      await tournament.save();
      
      console.log(`Tournament ${tournamentId} status updated from ${tournament.status} to ${newStatus}`);
    }

    return tournament;
  } catch (error) {
    console.error(`Error updating tournament status for ${tournamentId}:`, error);
    throw error;
  }
};

/**
 * Cập nhật trạng thái cho tất cả tournaments
 * @returns {Promise<Object>} - Kết quả cập nhật
 */
export const updateAllTournamentStatuses = async () => {
  try {
    const tournaments = await Tournament.find({
      status: { $nin: ["cancelled", "completed"] }
    });

    let updatedCount = 0;
    const results = [];

    for (const tournament of tournaments) {
      const oldStatus = tournament.status;
      const newStatus = calculateTournamentStatus(tournament);
      
      if (newStatus !== oldStatus) {
        tournament.status = newStatus;
        await tournament.save();
        updatedCount++;
        
        results.push({
          tournamentId: tournament._id,
          name: tournament.name,
          oldStatus,
          newStatus
        });
      }
    }

    console.log(`Updated ${updatedCount} tournament statuses`);
    
    return {
      success: true,
      updatedCount,
      results
    };
  } catch (error) {
    console.error("Error updating all tournament statuses:", error);
    throw error;
  }
};

/**
 * Cập nhật trạng thái cho tournaments của một owner
 * @param {string} ownerId - Owner ID
 * @returns {Promise<Object>} - Kết quả cập nhật
 */
export const updateOwnerTournamentStatuses = async (ownerId) => {
  try {
    const tournaments = await Tournament.find({
      organizerId: ownerId,
      status: { $nin: ["cancelled", "completed"] }
    });

    let updatedCount = 0;
    const results = [];

    for (const tournament of tournaments) {
      const oldStatus = tournament.status;
      const newStatus = calculateTournamentStatus(tournament);
      
      if (newStatus !== oldStatus) {
        tournament.status = newStatus;
        await tournament.save();
        updatedCount++;
        
        results.push({
          tournamentId: tournament._id,
          name: tournament.name,
          oldStatus,
          newStatus
        });
      }
    }

    console.log(`Updated ${updatedCount} tournament statuses for owner ${ownerId}`);
    
    return {
      success: true,
      updatedCount,
      results
    };
  } catch (error) {
    console.error(`Error updating tournament statuses for owner ${ownerId}:`, error);
    throw error;
  }
};
