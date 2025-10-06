import cron from "node-cron";
import { updateAllTournamentStatuses } from "../utils/tournamentStatusUpdater.js";

/**
 * Khởi tạo scheduled jobs cho tournament status updates
 */
export const initializeTournamentStatusJobs = () => {
  console.log("Initializing tournament status update jobs...");

  // Cập nhật status mỗi ngày lúc 6:00 sáng
  cron.schedule("0 6 * * *", async () => {
    try {
      console.log("Running daily tournament status update job...");
      const result = await updateAllTournamentStatuses();
      
      if (result.updatedCount > 0) {
        console.log(`Daily tournament status update completed: ${result.updatedCount} tournaments updated`);
        console.log("Updated tournaments:", result.results);
      } else {
        console.log("No tournaments needed status updates today");
      }
    } catch (error) {
      console.error("Error in daily tournament status update job:", error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });

  // Cập nhật status mỗi ngày lúc 18:00 chiều (backup job)
  cron.schedule("0 18 * * *", async () => {
    try {
      console.log("Running evening tournament status update job...");
      const result = await updateAllTournamentStatuses();
      
      if (result.updatedCount > 0) {
        console.log(`Evening tournament status update completed: ${result.updatedCount} tournaments updated`);
      } else {
        console.log("No tournaments needed status updates this evening");
      }
    } catch (error) {
      console.error("Error in evening tournament status update job:", error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });

  console.log("Tournament status update jobs initialized successfully (daily at 6:00 AM and 6:00 PM)");
};

/**
 * Dừng tất cả scheduled jobs
 */
export const stopTournamentStatusJobs = () => {
  console.log("Stopping tournament status update jobs...");
  cron.getTasks().forEach(task => {
    task.stop();
  });
  console.log("Tournament status update jobs stopped");
};
