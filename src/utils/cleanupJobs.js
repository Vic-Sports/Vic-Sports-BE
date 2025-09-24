import cron from "node-cron";
import Booking from "../models/booking.js";
import PaymentSession from "../models/paymentSession.js";
import logger from "../utils/logger.js";

// Cleanup expired reservations every minute
const cleanupExpiredReservations = async () => {
  try {
    const now = new Date();

    // Find and expire bookings with expired reservations
    const expiredBookings = await Booking.updateMany(
      {
        status: "reserved",
        reservationExpiresAt: { $lt: now },
        paymentStatus: "pending",
      },
      {
        $set: {
          status: "expired",
          expiredAt: now,
        },
      }
    );

    // Also expire related payment sessions
    if (expiredBookings.modifiedCount > 0) {
      const expiredBookingIds = await Booking.find({
        status: "expired",
        expiredAt: { $gte: new Date(now.getTime() - 60000) }, // Last minute
      }).select("_id");

      await PaymentSession.updateMany(
        {
          bookingId: { $in: expiredBookingIds.map((b) => b._id) },
          status: "pending",
        },
        {
          $set: { status: "expired" },
        }
      );
    }

    if (expiredBookings.modifiedCount > 0) {
      logger.info(
        `Cleaned up ${expiredBookings.modifiedCount} expired reservations`
      );
    }
  } catch (error) {
    logger.error("Error in cleanup job:", error);
  }
};

// Cleanup expired payment sessions every 5 minutes
const cleanupExpiredPaymentSessions = async () => {
  try {
    const now = new Date();

    const expiredSessions = await PaymentSession.updateMany(
      {
        status: "pending",
        expiresAt: { $lt: now },
      },
      {
        $set: { status: "expired" },
      }
    );

    if (expiredSessions.modifiedCount > 0) {
      logger.info(
        `Cleaned up ${expiredSessions.modifiedCount} expired payment sessions`
      );
    }
  } catch (error) {
    logger.error("Error in payment session cleanup job:", error);
  }
};

// Initialize cleanup jobs
export const initializeCleanupJobs = () => {
  // Run every minute for reservation cleanup
  cron.schedule("* * * * *", cleanupExpiredReservations);

  // Run every 5 minutes for payment session cleanup
  cron.schedule("*/5 * * * *", cleanupExpiredPaymentSessions);

  logger.info("Cleanup jobs initialized");
};

export { cleanupExpiredReservations, cleanupExpiredPaymentSessions };
