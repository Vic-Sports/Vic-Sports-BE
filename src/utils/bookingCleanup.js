import Booking from "../models/booking.js";
import payosService from "../services/payos.service.js";
import logger from "./logger.js";

/**
 * Cleanup stuck pending bookings to free up time slots
 * @param {number} maxAgeHours - Maximum age in hours for pending bookings
 * @returns {Object} Cleanup results
 */
export const cleanupStuckBookings = async (maxAgeHours = 2) => {
  try {
    logger.info(
      `Starting cleanup of pending bookings older than ${maxAgeHours} hours`
    );

    // Find bookings that are pending for more than maxAgeHours
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const stuckBookings = await Booking.find({
      status: "pending",
      paymentStatus: "pending",
      createdAt: { $lt: cutoffTime },
    });

    logger.info(`Found ${stuckBookings.length} stuck pending bookings`);

    let cancelledCount = 0;
    let errors = [];

    for (const booking of stuckBookings) {
      try {
        let shouldCancel = true;
        let cancellationReason = "Auto-cleanup: Payment timeout";

        // Check if there's a PayOS order code
        if (booking.payosOrderCode) {
          try {
            // Try to get payment status from PayOS
            const paymentResult = await payosService.getPaymentInfo(
              booking.payosOrderCode
            );

            if (paymentResult.success && paymentResult.data) {
              const paymentStatus = paymentResult.data.status;

              if (paymentStatus === "PAID") {
                // Payment was actually successful, update booking
                booking.status = "confirmed";
                booking.paymentStatus = "paid";
                booking.paidAt = new Date();
                booking.payosTransactionId =
                  paymentResult.data.transactions?.[0]?.reference;
                await booking.save();
                logger.info(
                  `Booking ${booking._id} marked as PAID (was stuck in pending)`
                );
                shouldCancel = false;
              } else if (
                paymentStatus === "CANCELLED" ||
                paymentStatus === "EXPIRED"
              ) {
                // Payment was already cancelled/expired
                cancellationReason = `Auto-cleanup: Payment ${paymentStatus.toLowerCase()}`;
                booking.paymentStatus =
                  paymentStatus === "EXPIRED" ? "expired" : "cancelled";
              }
            } else {
              // Cannot get PayOS info, assume cancelled
              cancellationReason = "Auto-cleanup: PayOS unreachable";
            }
          } catch (payosError) {
            logger.error(
              `Error checking PayOS status for booking ${booking._id}:`,
              payosError
            );
            cancellationReason = "Auto-cleanup: PayOS error";
          }
        } else {
          // No PayOS order code
          cancellationReason = "Auto-cleanup: No payment method";
        }

        if (shouldCancel) {
          booking.status = "cancelled";
          if (!booking.paymentStatus || booking.paymentStatus === "pending") {
            booking.paymentStatus = "cancelled";
          }
          booking.cancelledAt = new Date();
          booking.cancellationReason = cancellationReason;
          await booking.save();
          cancelledCount++;
          logger.info(
            `Cancelled booking ${booking._id} - ${cancellationReason}`
          );
        }
      } catch (error) {
        logger.error(`Error processing booking ${booking._id}:`, error);
        errors.push({
          bookingId: booking._id,
          error: error.message,
        });

        // Cancel anyway to free up the time slot
        try {
          booking.status = "cancelled";
          booking.paymentStatus = "cancelled";
          booking.cancelledAt = new Date();
          booking.cancellationReason = "Auto-cleanup: Processing error";
          await booking.save();
          cancelledCount++;
        } catch (saveError) {
          logger.error(
            `Failed to save booking ${booking._id} after error:`,
            saveError
          );
        }
      }
    }

    const result = {
      totalStuckBookings: stuckBookings.length,
      cancelledBookings: cancelledCount,
      errors: errors.length,
      maxAgeHours,
      cutoffTime,
      errorDetails: errors,
    };

    logger.info(`Cleanup completed:`, result);
    return result;
  } catch (error) {
    logger.error("Cleanup stuck bookings error:", error);
    throw error;
  }
};

/**
 * Schedule automatic cleanup job
 * Runs every hour to clean up bookings older than 2 hours
 */
export const scheduleBookingCleanup = () => {
  // Run cleanup every hour
  const intervalMs = 60 * 60 * 1000; // 1 hour
  const maxAgeHours = 2; // Cancel bookings older than 2 hours

  logger.info(
    `Scheduling booking cleanup job: every ${
      intervalMs / 1000 / 60
    } minutes, max age ${maxAgeHours} hours`
  );

  setInterval(async () => {
    try {
      await cleanupStuckBookings(maxAgeHours);
    } catch (error) {
      logger.error("Scheduled booking cleanup failed:", error);
    }
  }, intervalMs);

  // Run once immediately
  setTimeout(async () => {
    try {
      await cleanupStuckBookings(maxAgeHours);
    } catch (error) {
      logger.error("Initial booking cleanup failed:", error);
    }
  }, 30000); // Wait 30 seconds after server start
};

export default {
  cleanupStuckBookings,
  scheduleBookingCleanup,
};
