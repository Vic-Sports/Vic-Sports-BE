import Booking from "../models/booking.js";
import PaymentTransaction from "../models/paymentTransaction.js";
import payosService from "../services/payos.service.js";

// Utility functions
const generatePaymentRef = () => {
  return `PAY_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 6)
    .toUpperCase()}`;
};

// @desc    Get Payment Transaction
// @route   GET /api/payments/:paymentRef
// @access  Private
export const getPaymentTransaction = async (req, res) => {
  try {
    const { paymentRef } = req.params;

    const transaction = await PaymentTransaction.findOne({
      paymentRef,
    }).populate({
      path: "booking",
      populate: [
        { path: "court", select: "name sportType" },
        { path: "courtIds", select: "name sportType" },
        { path: "venue", select: "name address" },
      ],
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        transaction,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xác thực thanh toán PayOS
export const verifyPayOSPayment = async (req, res) => {
  try {
    console.log("=== PAYOS PAYMENT VERIFICATION ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      orderCode,
      amount,
      description,
      accountNumber,
      reference,
      transactionDateTime,
      currency,
    } = req.body;

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        message: "Order code is required",
      });
    }

    // Tìm booking theo payosOrderCode
    const booking = await Booking.findOne({ payosOrderCode: orderCode })
      .populate("venue", "name address")
      .populate("court", "name type")
      .populate("user", "fullName email phoneNumber");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    console.log("Found booking:", booking._id);

    // Lấy thông tin thanh toán từ PayOS
    try {
      const paymentResult = await payosService.getPaymentInfo(orderCode);
      console.log("PayOS payment result:", paymentResult);

      if (!paymentResult.success) {
        return res.status(400).json({
          success: false,
          message: "Failed to get payment info from PayOS",
          error: paymentResult.error,
        });
      }

      const paymentInfo = paymentResult.data;

      // Kiểm tra trạng thái thanh toán theo docs PayOS mới
      if (paymentInfo.status === "PAID") {
        // Cập nhật booking thành công
        booking.paymentStatus = "paid";
        booking.status = "confirmed";
        booking.payosTransactionId =
          paymentResult.transactions?.[0]?.reference || reference;
        booking.paidAt = new Date();

        await booking.save();

        console.log("Payment verified successfully");

        return res.status(200).json({
          success: true,
          data: {
            booking: {
              id: booking._id,
              bookingCode: booking.bookingCode,
              status: booking.status,
              paymentStatus: booking.paymentStatus,
              payosOrderCode: booking.payosOrderCode,
              payosTransactionId: booking.payosTransactionId,
              venue: booking.venue,
              court: booking.court,
              date: booking.date,
              timeSlots: booking.timeSlots,
              totalPrice: booking.totalPrice,
              paidAt: booking.paidAt,
            },
            paymentInfo: {
              orderCode: paymentResult.orderCode,
              amount: paymentResult.amount,
              currency: paymentResult.currency,
              status: paymentResult.status,
              paidAt: paymentResult.paidAt,
            },
          },
          message: "Payment verified successfully",
        });
      } else if (paymentInfo.status === "CANCELLED") {
        // Cập nhật booking bị hủy
        booking.paymentStatus = "cancelled";
        booking.status = "cancelled";
        booking.cancelledAt = new Date();
        booking.cancellationReason = "Payment cancelled by user or expired";
        await booking.save();

        console.log(
          `Booking ${booking._id} marked as cancelled due to payment cancellation`
        );

        return res.status(200).json({
          success: false,
          status: "CANCELLED",
          message: "Payment failed or cancelled",
        });
      } else {
        // Thanh toán vẫn đang pending/unknown
        const flow = process.env.PAYOS_FLOW || process.env.NODE_ENV || "poll"; // poll | webhook
        const pendingPayload = {
          success: false,
          status: paymentInfo.status || "UNKNOWN",
          message: "Payment is pending",
        };

        if (
          String(flow).toLowerCase() === "poll" ||
          String(flow).toLowerCase() === "development"
        ) {
          // Dev/local: trả 202 để FE hiểu đang xử lý và tiếp tục poll
          return res.status(202).json(pendingPayload);
        }
        // Prod/webhook: vẫn trả 200 nhưng FE nên dựa webhook là chính
        return res.status(200).json(pendingPayload);
      }
    } catch (payosError) {
      console.error("PayOS verification error:", payosError);

      return res.status(400).json({
        success: false,
        message: "Failed to verify payment with PayOS",
        error: payosError.message,
      });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Webhook để nhận thông báo từ PayOS
export const payosWebhook = async (req, res) => {
  try {
    console.log("=== PAYOS WEBHOOK ===");
    console.log("Headers:", req.headers);
    console.log("Body:", JSON.stringify(req.body, null, 2));

    // PayOS v2: signature trong header x-payos-signature
    const signature = req.headers["x-payos-signature"];

    if (!signature) {
      console.log("Missing PayOS signature in header");
      return res.status(400).json({
        success: false,
        message: "Missing signature",
      });
    }

    // Xác thực webhook signature với PayOS v2
    const isValidSignature = payosService.verifyWebhookSignature(
      req.body, // Raw body object
      signature // Signature từ header
    );

    if (!isValidSignature) {
      console.log("Invalid PayOS signature");
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    console.log("Webhook signature verified successfully");

    // PayOS v2 webhook format
    const { data } = req.body;

    if (!data || !data.orderCode) {
      console.log("Invalid webhook data format");
      return res.status(400).json({
        success: false,
        message: "Invalid webhook data",
      });
    }

    // Tìm booking theo orderCode
    const booking = await Booking.findOne({
      payosOrderCode: data.orderCode,
    });

    if (!booking) {
      console.log("Booking not found for orderCode:", data.orderCode);
      // Vẫn trả về 200 để PayOS không gửi lại
      return res.status(200).json({
        success: true,
        message: "Booking not found, but webhook acknowledged",
      });
    }

    console.log("Processing webhook for booking:", booking._id);
    // PayOS v2 uses top-level `code` to indicate result ("00" = success)
    const orderCode = data.orderCode;
    const webhookCode = String(req.body.code || "");

    console.log("Webhook code:", webhookCode);
    console.log("Payment data:", JSON.stringify(data));

    // Interpret webhook: code === "00" means success
    const isSuccess = webhookCode === "00";

    if (isSuccess) {
      // Mark booking as paid/confirmed
      booking.paymentStatus = "paid";
      booking.status = "confirmed";
      booking.payosTransactionId =
        data.transactions?.[0]?.reference || data.reference;
      booking.paidAt = new Date();
      console.log(`Payment successful for orderCode: ${orderCode}`);
    } else {
      // Non-00 codes mean failure/pending/other — treat as failed for now
      booking.paymentStatus = "failed";
      booking.status = "cancelled";
      booking.cancelledAt = new Date();
      booking.cancellationReason = `Payment not successful, code: ${webhookCode}`;
      console.log(
        `Payment failed or has other status for orderCode: ${orderCode}. Code: ${webhookCode}`
      );
    }

    await booking.save();
    console.log("Booking updated successfully");

    // Trả về 200 để PayOS biết webhook đã được xử lý thành công
    res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("PayOS webhook error:", error);
    // Trả về 500 để PayOS thử gửi lại webhook
    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

// Lấy trạng thái thanh toán
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderCode } = req.params;

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        message: "Order code is required",
      });
    }

    // Tìm booking
    const booking = await Booking.findOne({ payosOrderCode: orderCode })
      .populate("venue", "name")
      .populate("court", "name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Lấy thông tin từ PayOS
    try {
      const paymentResult = await payosService.getPaymentInfo(orderCode);

      if (paymentResult.success) {
        res.status(200).json({
          success: true,
          data: {
            orderCode: paymentResult.orderCode,
            status: paymentResult.status,
          },
        });
      } else {
        throw new Error(paymentResult.error);
      }
    } catch (payosError) {
      console.error("PayOS get payment info error:", payosError);

      // Trả về thông tin booking nếu không lấy được từ PayOS
      res.status(200).json({
        success: true,
        data: {
          booking: {
            id: booking._id,
            bookingCode: booking.bookingCode,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
            venue: booking.venue,
            court: booking.court,
            date: booking.date,
            timeSlots: booking.timeSlots,
            totalPrice: booking.totalPrice,
            payosOrderCode: booking.payosOrderCode,
            payosTransactionId: booking.payosTransactionId,
            paidAt: booking.paidAt,
          },
        },
        message: "Booking info only (PayOS API error)",
      });
    }
  } catch (error) {
    console.error("Get payment status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// @desc    Tạo PayOS payment link trực tiếp
// @route   POST /api/payments/payos/create
// @access  Private
export const createPayOSPayment = async (req, res) => {
  try {
    console.log("=== CREATE PAYOS PAYMENT ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      bookingId,
      amount,
      description,
      items,
      buyerName,
      buyerEmail,
      buyerPhone,
      returnUrl,
      cancelUrl,
      expiredAt,
    } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookingId, amount",
      });
    }

    // Tìm booking
    const booking = await Booking.findById(bookingId)
      .populate("venue", "name")
      .populate("court", "name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Idempotent behavior: if booking already has a PayOS order, return existing payment info
    if (booking.payosOrderCode) {
      try {
        const existing = await payosService.getPaymentInfo(
          booking.payosOrderCode
        );
        if (existing.success) {
          return res.status(200).json({
            success: true,
            data: {
              booking: {
                id: booking._id,
                bookingCode: booking.bookingCode,
                payosOrderCode: booking.payosOrderCode,
              },
              payment: {
                orderCode: existing.data?.orderCode,
                checkoutUrl:
                  existing.data?.checkoutUrl ||
                  existing.data?.data?.checkoutUrl,
                qrCode: existing.data?.qrCode || existing.data?.data?.qrCode,
                paymentLinkId:
                  existing.data?.paymentLinkId ||
                  existing.data?.data?.paymentLinkId,
                amount: existing.data?.amount,
                currency:
                  existing.data?.currency ||
                  existing.data?.data?.currency ||
                  "VND",
                status:
                  existing.data?.status ||
                  existing.data?.data?.status ||
                  "PENDING",
                // Normalized
                paymentUrl:
                  existing.data?.checkoutUrl ||
                  existing.data?.data?.checkoutUrl ||
                  null,
                paymentRef:
                  existing.data?.paymentLinkId ||
                  existing.data?.data?.paymentLinkId ||
                  String(booking.payosOrderCode),
              },
            },
            message: "Existing PayOS payment link returned",
          });
        }
      } catch (e) {
        // fall through to creation if fetching existing fails
      }
    }

    // Tạo unique order code (PayOS yêu cầu duy nhất)
    const orderCode = Math.floor(Date.now() / 1000);

    // PayOS giới hạn mô tả <= 25 ký tự
    const fallbackDesc = `Đặt sân ${booking.court?.name || "N/A"} - ${
      booking.venue?.name || "N/A"
    }`;
    const rawDescription = description || fallbackDesc;
    const safeDescription = String(rawDescription).slice(0, 25);

    const paymentData = {
      orderCode,
      amount: Number(amount),
      description: safeDescription,
      items: items || [
        {
          name: `${booking.court?.name || "Court"} - ${
            booking.venue?.name || "Venue"
          }`,
          quantity: 1,
          price: Number(amount),
        },
      ],
      buyerName,
      buyerEmail,
      buyerPhone,
      // Use frontend URLs so PayOS redirects directly to frontend
      returnUrl: `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/booking/payos-return`,
      cancelUrl: `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/booking/payos-return`,
      expiredAt,
    };

    console.log("Creating PayOS payment with data:", paymentData);

    // Gọi PayOS bằng SDK
    const result = await payosService.createPaymentLinkSDK(paymentData);

    if (result.success) {
      // Cập nhật booking với PayOS order code
      booking.payosOrderCode = orderCode;
      booking.paymentMethod = "payos";
      await booking.save();

      console.log("PayOS payment created successfully");

      return res.status(201).json({
        success: true,
        data: {
          booking: {
            id: booking._id,
            bookingCode: booking.bookingCode,
            payosOrderCode: orderCode,
          },
          payment: {
            orderCode,
            checkoutUrl:
              result.data?.checkoutUrl || result.data?.data?.checkoutUrl,
            qrCode: result.data?.qrCode || result.data?.data?.qrCode,
            paymentLinkId:
              result.data?.paymentLinkId || result.data?.data?.paymentLinkId,
            amount: Number(amount),
            currency:
              result.data?.currency || result.data?.data?.currency || "VND",
            status:
              result.data?.status || result.data?.data?.status || "PENDING",
            // Normalized fields for FE
            paymentUrl:
              result.data?.checkoutUrl ||
              result.data?.data?.checkoutUrl ||
              null,
            paymentRef:
              result.data?.paymentLinkId ||
              result.data?.data?.paymentLinkId ||
              String(orderCode),
          },
        },
        message: "PayOS payment link created successfully",
      });
    } else {
      console.error("PayOS payment creation failed:", result.error);

      return res.status(400).json({
        success: false,
        message: "Failed to create PayOS payment",
        error: result.error,
        details: result.details,
      });
    }
  } catch (error) {
    console.error("Create PayOS payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// @desc    Hủy PayOS payment link
// @route   POST /api/payments/payos/:orderCode/cancel
// @access  Private
export const cancelPayOSPayment = async (req, res) => {
  try {
    const { orderCode } = req.params;
    const { reason } = req.body;

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        message: "Order code is required",
      });
    }

    console.log(`Cancelling PayOS payment: ${orderCode}`);

    // Tìm booking
    const booking = await Booking.findOne({ payosOrderCode: orderCode });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Hủy payment link với PayOS
    const result = await payosService.cancelPaymentLink(orderCode);

    if (result.success) {
      // Cập nhật booking status
      booking.paymentStatus = "cancelled";
      booking.status = "cancelled";
      booking.cancellationReason = reason || "Payment cancelled by user";
      booking.cancelledAt = new Date();
      await booking.save();

      console.log(
        `PayOS payment cancelled successfully for booking ${booking._id}`
      );

      return res.status(200).json({
        success: true,
        data: {
          booking: {
            id: booking._id,
            bookingCode: booking.bookingCode,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
          },
        },
        message: "PayOS payment cancelled successfully",
      });
    } else {
      // PayOS cancel failed, return error
      console.error("PayOS cancel failed:", result.error || result);
      return res.status(400).json({
        success: false,
        message: "Failed to cancel PayOS payment",
        error: result.error || result.details || "PayOS cancel request failed",
      });
    }
  } catch (error) {
    console.error("Cancel PayOS payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// @desc    Cleanup stuck pending bookings
// @route   POST /api/payments/cleanup-pending
// @access  Admin/Private
export const cleanupPendingBookings = async (req, res) => {
  try {
    const { maxAgeHours = 24 } = req.body; // Default 24 hours

    console.log(
      `Starting cleanup of pending bookings older than ${maxAgeHours} hours`
    );

    // Find bookings that are pending for more than maxAgeHours
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const stuckBookings = await Booking.find({
      status: "pending",
      paymentStatus: "pending",
      createdAt: { $lt: cutoffTime },
    });

    console.log(`Found ${stuckBookings.length} stuck pending bookings`);

    let cancelledCount = 0;

    for (const booking of stuckBookings) {
      // Check if there's a PayOS order code
      if (booking.payosOrderCode) {
        try {
          // Try to get payment status from PayOS
          const paymentResult = await payosService.getPaymentInfo(
            booking.payosOrderCode
          );

          if (paymentResult.success) {
            const paymentStatus = paymentResult.data?.status;

            if (paymentStatus === "CANCELLED" || paymentStatus === "EXPIRED") {
              // Payment was already cancelled/expired, update booking
              booking.status = "cancelled";
              booking.paymentStatus =
                paymentStatus === "EXPIRED" ? "expired" : "cancelled";
              booking.cancelledAt = new Date();
              booking.cancellationReason = `Auto-cleanup: Payment ${paymentStatus.toLowerCase()}`;
              await booking.save();
              cancelledCount++;
              console.log(
                `Cancelled booking ${booking._id} - PayOS status: ${paymentStatus}`
              );
            } else if (paymentStatus === "PENDING") {
              // Payment still pending, cancel it
              const cancelResult = await payosService.cancelPaymentLink(
                booking.payosOrderCode
              );
              if (cancelResult.success) {
                booking.status = "cancelled";
                booking.paymentStatus = "cancelled";
                booking.cancelledAt = new Date();
                booking.cancellationReason = "Auto-cleanup: Payment timeout";
                await booking.save();
                cancelledCount++;
                console.log(
                  `Cancelled booking ${booking._id} - Timeout cleanup`
                );
              }
            }
          } else {
            // Cannot get PayOS info, assume cancelled
            booking.status = "cancelled";
            booking.paymentStatus = "cancelled";
            booking.cancelledAt = new Date();
            booking.cancellationReason = "Auto-cleanup: PayOS unreachable";
            await booking.save();
            cancelledCount++;
            console.log(`Cancelled booking ${booking._id} - PayOS unreachable`);
          }
        } catch (error) {
          console.error(`Error processing booking ${booking._id}:`, error);
          // Cancel anyway to free up the time slot
          booking.status = "cancelled";
          booking.paymentStatus = "cancelled";
          booking.cancelledAt = new Date();
          booking.cancellationReason = "Auto-cleanup: Processing error";
          await booking.save();
          cancelledCount++;
        }
      } else {
        // No PayOS order code, just cancel
        booking.status = "cancelled";
        booking.paymentStatus = "cancelled";
        booking.cancelledAt = new Date();
        booking.cancellationReason = "Auto-cleanup: No payment method";
        await booking.save();
        cancelledCount++;
        console.log(`Cancelled booking ${booking._id} - No payment method`);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalStuckBookings: stuckBookings.length,
        cancelledBookings: cancelledCount,
        maxAgeHours,
        cutoffTime,
      },
      message: `Cleanup completed: ${cancelledCount} bookings cancelled`,
    });
  } catch (error) {
    console.error("Cleanup pending bookings error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// @desc    Debug booking cancellation issues
// @route   GET /api/payments/debug-bookings
// @access  Admin
export const debugBookingCancellation = async (req, res) => {
  try {
    const { debugBookingCancellation } = await import(
      "../utils/bookingDebug.js"
    );
    const result = await debugBookingCancellation();

    res.status(200).json({
      success: true,
      data: result,
      message: "Booking debug completed",
    });
  } catch (error) {
    console.error("Debug booking cancellation error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// @desc    Fix inconsistent booking statuses
// @route   POST /api/payments/fix-bookings
// @access  Admin
export const fixInconsistentBookings = async (req, res) => {
  try {
    const { fixInconsistentBookings } = await import(
      "../utils/bookingDebug.js"
    );
    const result = await fixInconsistentBookings();

    res.status(200).json({
      success: true,
      data: result,
      message: `Fixed ${result.fixedCount} inconsistent bookings`,
    });
  } catch (error) {
    console.error("Fix inconsistent bookings error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// @desc    Handle PayOS return (success)
// @route   GET /api/payments/payos/return
// @access  Public
export const payosReturn = async (req, res) => {
  try {
    const { orderCode, code, id, cancel, status } = req.query;

    console.log("=== PAYOS RETURN ===");
    console.log("Query params:", req.query);

    if (!orderCode) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/booking/error?message=Missing orderCode`
      );
    }

    // Tìm booking theo orderCode
    const booking = await Booking.findOne({ payosOrderCode: orderCode });

    if (!booking) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/booking/error?message=Booking not found`
      );
    }

    // Check if this is a cancel request (cancel=true OR status=CANCELLED)
    if (cancel === "true" || status === "CANCELLED") {
      // Handle cancellation
      booking.paymentStatus = "cancelled";
      booking.status = "cancelled";
      booking.cancelledAt = new Date();
      booking.cancellationReason = "Payment cancelled by user";
      await booking.save();

      console.log(`Payment cancelled for booking ${booking._id}`);

      // Redirect to frontend payos-return with cancel params (for FE to display properly)
      const redirectUrl =
        `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/booking/payos-return?` +
        `code=${code || "00"}&` +
        `id=${id || ""}&` +
        `cancel=true&` +
        `status=CANCELLED&` +
        `orderCode=${orderCode}&` +
        `bookingId=${booking._id}&` +
        `bookingCode=${booking.bookingCode}`;

      return res.redirect(redirectUrl);
    }

    try {
      // Verify payment với PayOS
      const paymentResult = await payosService.getPaymentInfo(orderCode);

      if (paymentResult.success && paymentResult.data) {
        const paymentStatus = paymentResult.data.status;

        if (paymentStatus === "PAID") {
          // Payment thành công
          booking.paymentStatus = "paid";
          booking.status = "confirmed";
          booking.paidAt = new Date();
          booking.payosTransactionId =
            paymentResult.data.transactions?.[0]?.reference;
          await booking.save();

          console.log(`Payment successful for booking ${booking._id}`);

          // Redirect đến trang success với thông tin booking
          const redirectUrl =
            `${
              process.env.FRONTEND_URL || "http://localhost:5173"
            }/booking/success?` +
            `bookingId=${booking._id}&` +
            `orderCode=${orderCode}&` +
            `status=paid&` +
            `amount=${paymentResult.data.amount || booking.totalPrice}&` +
            `bookingCode=${booking.bookingCode}`;

          return res.redirect(redirectUrl);
        } else {
          // Payment failed hoặc cancelled
          booking.paymentStatus =
            paymentStatus === "CANCELLED" ? "cancelled" : "failed";
          booking.status = "cancelled";
          booking.cancelledAt = new Date();
          booking.cancellationReason = `Payment ${paymentStatus.toLowerCase()}`;
          await booking.save();

          console.log(`Payment ${paymentStatus} for booking ${booking._id}`);

          // Redirect đến trang cancel/failed
          const redirectUrl =
            `${
              process.env.FRONTEND_URL || "http://localhost:5173"
            }/booking/cancel?` +
            `bookingId=${booking._id}&` +
            `orderCode=${orderCode}&` +
            `status=${paymentStatus.toLowerCase()}&` +
            `reason=${encodeURIComponent(
              "Payment " + paymentStatus.toLowerCase()
            )}&` +
            `bookingCode=${booking.bookingCode}`;

          return res.redirect(redirectUrl);
        }
      } else {
        throw new Error(paymentResult.error || "Failed to verify payment");
      }
    } catch (payosError) {
      console.error("PayOS verification error in return:", payosError);

      // Fallback: redirect với error
      const redirectUrl =
        `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/booking/error?` +
        `bookingId=${booking._id}&` +
        `orderCode=${orderCode}&` +
        `message=${encodeURIComponent("Payment verification failed")}&` +
        `bookingCode=${booking.bookingCode}`;

      return res.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("PayOS return error:", error);

    const redirectUrl =
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/booking/error?` +
      `message=${encodeURIComponent("Internal server error")}`;

    return res.redirect(redirectUrl);
  }
};

// @desc    Handle PayOS cancel
// @route   GET /api/payments/payos/cancel
// @access  Public
export const payosCancel = async (req, res) => {
  try {
    const { orderCode, code, id, cancel, status } = req.query;

    console.log("=== PAYOS CANCEL ===");
    console.log("Query params:", req.query);

    if (!orderCode) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/booking/cancel?message=Payment cancelled`
      );
    }

    // Tìm booking theo orderCode
    const booking = await Booking.findOne({ payosOrderCode: orderCode });

    if (booking) {
      // Cập nhật booking status
      booking.paymentStatus = "cancelled";
      booking.status = "cancelled";
      booking.cancelledAt = new Date();
      booking.cancellationReason = "Payment cancelled by user";
      await booking.save();

      console.log(`Payment cancelled for booking ${booking._id}`);

      // Redirect đến trang cancel với thông tin booking
      const redirectUrl =
        `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/booking/cancel?` +
        `bookingId=${booking._id}&` +
        `orderCode=${orderCode}&` +
        `status=cancelled&` +
        `reason=${encodeURIComponent("Payment cancelled by user")}&` +
        `bookingCode=${booking.bookingCode}`;

      return res.redirect(redirectUrl);
    } else {
      console.log(`Booking not found for cancelled orderCode: ${orderCode}`);

      // Redirect đến trang cancel chung
      const redirectUrl =
        `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/booking/cancel?` +
        `orderCode=${orderCode}&` +
        `status=cancelled&` +
        `message=${encodeURIComponent("Payment cancelled")}`;

      return res.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("PayOS cancel error:", error);

    const redirectUrl =
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/booking/cancel?` +
      `message=${encodeURIComponent("Payment cancelled")}`;

    return res.redirect(redirectUrl);
  }
};
