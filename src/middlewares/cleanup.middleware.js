import Booking from "../models/booking.js";
import payosService from "../services/payos.service.js";
import logger from "../utils/logger.js";

/**
 * Middleware to auto-cancel expired pending bookings before availability check
 * This ensures time slots are freed up when payments timeout
 */
export const autoCleanupBeforeAvailabilityCheck = async (req, res, next) => {
  try {
    // Only run cleanup for availability-related requests
    const isAvailabilityCheck =
      req.path.includes("available") ||
      req.path.includes("search") ||
      req.method === "POST"; // For booking creation

    if (!isAvailabilityCheck) {
      return next();
    }

    const { date, venueId, courtIds } = req.body || req.query;

    // Only cleanup if we have specific date/venue/court to check
    if (!date) {
      return next();
    }

    // Find recent pending bookings for the requested date/venue/courts
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes

    const query = {
      status: "pending",
      paymentStatus: "pending",
      date: date,
      createdAt: { $lt: fiveMinutesAgo },
    };

    // Add venue filter if provided
    if (venueId) {
      query.venue = venueId;
    }

    // Add court filter if provided
    if (courtIds) {
      if (Array.isArray(courtIds)) {
        query.$or = [
          { court: { $in: courtIds } },
          { courtIds: { $elemMatch: { $in: courtIds } } },
        ];
      } else {
        query.$or = [{ court: courtIds }, { courtIds: courtIds }];
      }
    }

    const expiredBookings = await Booking.find(query);

    if (expiredBookings.length > 0) {
      logger.info(
        `Auto-cleanup: Found ${expiredBookings.length} expired pending bookings for availability check`
      );

      // Quick cleanup for these specific bookings
      for (const booking of expiredBookings) {
        try {
          let shouldCancel = true;

          // Quick PayOS status check if order code exists
          if (booking.payosOrderCode) {
            try {
              const paymentResult = await payosService.getPaymentInfo(
                booking.payosOrderCode
              );

              if (
                paymentResult.success &&
                paymentResult.data?.status === "PAID"
              ) {
                // Payment was successful, update booking
                booking.status = "confirmed";
                booking.paymentStatus = "paid";
                booking.paidAt = new Date();
                await booking.save();
                shouldCancel = false;
                logger.info(
                  `Auto-cleanup: Booking ${booking._id} confirmed (payment found)`
                );
              }
            } catch (payosError) {
              logger.warn(
                `Auto-cleanup: PayOS check failed for booking ${booking._id}, assuming cancelled`
              );
            }
          }

          if (shouldCancel) {
            booking.status = "cancelled";
            booking.paymentStatus = "cancelled";
            booking.cancelledAt = new Date();
            booking.cancellationReason =
              "Auto-cleanup: Payment timeout before availability check";
            await booking.save();
            logger.info(`Auto-cleanup: Cancelled booking ${booking._id}`);
          }
        } catch (error) {
          logger.error(`Auto-cleanup error for booking ${booking._id}:`, error);
        }
      }
    }

    next();
  } catch (error) {
    logger.error("Auto-cleanup middleware error:", error);
    // Don't block the request if cleanup fails
    next();
  }
};

export default autoCleanupBeforeAvailabilityCheck;
