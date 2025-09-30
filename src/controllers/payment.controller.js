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
        await booking.save();

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

    const signature = req.headers["x-payos-signature"];

    if (!signature) {
      console.log("Missing PayOS signature");
      return res.status(400).json({
        success: false,
        message: "Missing signature",
      });
    }

    // Xác thực webhook signature theo docs PayOS
    const isValidSignature = payosService.verifyWebhookSignature(
      req.body, // Truyền raw body object, không stringify
      signature
    );

    if (!isValidSignature) {
      console.log("Invalid PayOS signature");
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    console.log("Webhook signature verified");

    const { data } = req.body;

    if (!data || !data.orderCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook data",
      });
    }

    // Tìm booking
    const booking = await Booking.findOne({
      payosOrderCode: data.orderCode,
    });

    if (!booking) {
      console.log("Booking not found for orderCode:", data.orderCode);
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    console.log("Processing webhook for booking:", booking._id);

    // Cập nhật trạng thái booking
    switch (data.code) {
      case "00": // Thành công
        booking.paymentStatus = "paid";
        booking.status = "confirmed";
        booking.payosTransactionId = data.reference;
        booking.paidAt = new Date();
        break;

      case "01": // Thất bại
        booking.paymentStatus = "failed";
        booking.status = "cancelled";
        break;

      case "02": // Hủy
        booking.paymentStatus = "cancelled";
        booking.status = "cancelled";
        break;

      default:
        console.log("Unknown payment status code:", data.code);
        break;
    }

    await booking.save();

    console.log("Booking updated successfully");

    // Trả về success để PayOS biết webhook đã được xử lý
    res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("PayOS webhook error:", error);
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
      returnUrl,
      cancelUrl,
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

      console.log("PayOS payment cancelled successfully");

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
      console.error("PayOS payment cancellation failed:", result.error);

      return res.status(400).json({
        success: false,
        message: "Failed to cancel PayOS payment",
        error: result.error,
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
