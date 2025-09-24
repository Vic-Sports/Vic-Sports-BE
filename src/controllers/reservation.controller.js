import { asyncHandler } from "../middlewares/async.middleware.js";
import { ErrorResponse } from "../utils/errorResponse.js";
import Booking from "../models/booking.js";
import Court from "../models/court.js";
import Venue from "../models/venue.js";
import PaymentSession from "../models/paymentSession.js";
import crypto from "crypto";
import axios from "axios";
import querystring from "querystring";

// Payment gateway configurations
const PAYMENT_CONFIG = {
  vnpay: {
    vnp_TmnCode: process.env.VNP_TMN_CODE || "DEMO",
    vnp_HashSecret: process.env.VNP_HASH_SECRET || "DEMOKEY",
    vnp_Url:
      process.env.VNP_URL ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    vnp_ReturnUrl:
      process.env.VNP_RETURN_URL ||
      "http://localhost:3000/api/v1/payment/vnpay/return",
    vnp_IpnUrl:
      process.env.VNP_IPN_URL ||
      "http://localhost:3000/api/v1/payment/vnpay/webhook",
  },
  momo: {
    partnerCode: process.env.MOMO_PARTNER_CODE || "DEMO",
    accessKey: process.env.MOMO_ACCESS_KEY || "DEMO",
    secretKey: process.env.MOMO_SECRET_KEY || "DEMO",
    endpoint:
      process.env.MOMO_ENDPOINT ||
      "https://test-payment.momo.vn/v2/gateway/api/create",
    redirectUrl:
      process.env.MOMO_REDIRECT_URL ||
      "http://localhost:3000/api/v1/payment/momo/return",
    ipnUrl:
      process.env.MOMO_IPN_URL ||
      "http://localhost:3000/api/v1/payment/momo/webhook",
  },
  zalopay: {
    appId: process.env.ZALO_APP_ID || "2553",
    key1: process.env.ZALO_KEY1 || "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
    key2: process.env.ZALO_KEY2 || "kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz",
    endpoint:
      process.env.ZALO_ENDPOINT || "https://sb-openapi.zalopay.vn/v2/create",
    callbackUrl:
      process.env.ZALO_CALLBACK_URL ||
      "http://localhost:3000/api/v1/payment/zalopay/webhook",
  },
};

// @desc    Create booking with payment session (15-minute reservation)
// @route   POST /api/v1/bookings/create-payment-session
// @access  Private
export const createBookingPaymentSession = asyncHandler(
  async (req, res, next) => {
    const {
      courtId,
      date,
      timeSlots,
      courtQuantity = 1,
      customerInfo,
      paymentMethod,
      notes,
    } = req.body;

    // Validate required fields
    if (
      !courtId ||
      !date ||
      !timeSlots ||
      !timeSlots.length ||
      !customerInfo ||
      !paymentMethod
    ) {
      return next(new ErrorResponse("Thiếu thông tin bắt buộc", 400));
    }

    // Validate customer info
    if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.email) {
      return next(new ErrorResponse("Thông tin khách hàng không đầy đủ", 400));
    }

    // Get court and venue details
    const court = await Court.findById(courtId).populate("venue");
    if (!court) {
      return next(new ErrorResponse("Không tìm thấy sân", 404));
    }

    const venue = court.venue;

    // Check court availability (including active reservations)
    const conflicts = await checkCourtAvailability(courtId, date, timeSlots);
    if (conflicts.length > 0) {
      return next(
        new ErrorResponse("Sân đã được đặt hoặc đang được giữ chỗ", 409, {
          code: "P002",
          details: {
            courtId,
            conflictingTimeSlots: conflicts.map((c) => c.timeSlots).flat(),
            reservedBy: conflicts[0].user,
            reservationExpiresAt: conflicts[0].reservationExpiresAt,
          },
        })
      );
    }

    // Calculate total amount
    const totalAmount =
      timeSlots.reduce((sum, slot) => sum + slot.price, 0) * courtQuantity;

    // Create booking with reserved status (15-minute reservation)
    const now = new Date();
    const reservationExpiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    const booking = await Booking.create({
      user: req.user.id,
      court: courtId,
      venue: venue._id,
      date: new Date(date),
      timeSlots,
      courtQuantity,
      totalAmount,
      customerInfo,
      notes,
      paymentMethod,
      status: "reserved",
      reservedAt: now,
      reservationExpiresAt,
    });

    // Create payment session
    const paymentSession = await PaymentSession.create({
      bookingId: booking._id,
      paymentMethod,
      amount: totalAmount,
    });

    let paymentUrl = "";
    let qrCode = "";

    try {
      // Generate payment URL based on method
      switch (paymentMethod) {
        case "vnpay":
          const vnpayResult = await createVNPayURL(
            paymentSession,
            booking,
            court,
            venue
          );
          paymentUrl = vnpayResult.paymentUrl;
          break;
        case "momo":
          const momoResult = await createMoMoURL(
            paymentSession,
            booking,
            court,
            venue
          );
          paymentUrl = momoResult.payUrl;
          qrCode = momoResult.qrCodeUrl;
          break;
        case "zalopay":
          const zalopayResult = await createZaloPayURL(
            paymentSession,
            booking,
            court,
            venue
          );
          paymentUrl = zalopayResult.order_url;
          break;
        default:
          return next(
            new ErrorResponse("Phương thức thanh toán không hỗ trợ", 400)
          );
      }

      // Update payment session with URLs
      paymentSession.paymentUrl = paymentUrl;
      paymentSession.qrCode = qrCode;
      await paymentSession.save();

      res.status(201).json({
        success: true,
        data: {
          bookingId: booking._id,
          paymentSessionId: paymentSession.id,
          paymentUrl,
          qrCode,
          expiresAt: paymentSession.expiresAt,
          reservationExpiresAt: booking.reservationExpiresAt,
          booking: {
            id: booking._id,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
            totalPrice: booking.totalAmount,
            courtName: court.courtName,
            venue: venue.name,
          },
        },
        message: "Court reserved for 15 minutes. Please complete payment.",
      });
    } catch (error) {
      // If payment URL creation fails, mark booking as expired
      booking.status = "expired";
      booking.expiredAt = new Date();
      await booking.save();

      // Also mark payment session as failed
      paymentSession.status = "failed";
      await paymentSession.save();

      return next(
        new ErrorResponse(`Lỗi tạo URL thanh toán: ${error.message}`, 500)
      );
    }
  }
);

// @desc    Check court availability (including reservations)
// @route   GET /api/v1/courts/:courtId/availability
// @access  Public
export const checkCourtAvailabilityAPI = asyncHandler(
  async (req, res, next) => {
    const { courtId } = req.params;
    const { date, timeSlots } = req.query;

    if (!date) {
      return next(new ErrorResponse("Ngày là bắt buộc", 400));
    }

    const court = await Court.findById(courtId);
    if (!court) {
      return next(new ErrorResponse("Không tìm thấy sân", 404));
    }

    let slotsToCheck = [];
    if (timeSlots) {
      // Parse timeSlots parameter (can be comma-separated)
      const slots = Array.isArray(timeSlots) ? timeSlots : timeSlots.split(",");
      slotsToCheck = slots.map((slot) => {
        const [start, end] = slot.split("-");
        return { start, end };
      });
    } else {
      // Check all default time slots if none specified
      slotsToCheck = court.defaultAvailability || [];
    }

    // Get all bookings for this court on this date
    const bookings = await Booking.find({
      court: courtId,
      date: new Date(date),
      status: { $in: ["reserved", "confirmed"] },
    }).populate("user", "name");

    // Filter active reservations (not expired)
    const now = new Date();
    const activeBookings = bookings.filter((booking) => {
      if (booking.status === "confirmed") return true;
      if (booking.status === "reserved") {
        return new Date(booking.reservationExpiresAt) > now;
      }
      return false;
    });

    // Check availability for each time slot
    const timeSlotAvailability = slotsToCheck.map((slot) => {
      const conflict = activeBookings.find((booking) => {
        return booking.timeSlots.some((bookingSlot) =>
          timeSlotsOverlap(slot, bookingSlot)
        );
      });

      let status = "available";
      let reservedBy = null;
      let reservationExpiresAt = null;

      if (conflict) {
        status = conflict.status === "confirmed" ? "booked" : "reserved";
        reservedBy = conflict.user._id;
        if (conflict.status === "reserved") {
          reservationExpiresAt = conflict.reservationExpiresAt;
        }
      }

      return {
        start: slot.start,
        end: slot.end,
        isAvailable: !conflict,
        status,
        reservedBy,
        reservationExpiresAt,
        price: calculateSlotPrice(court, slot), // You'll need to implement this
      };
    });

    res.status(200).json({
      success: true,
      data: {
        courtId,
        date,
        timeSlots: timeSlotAvailability,
      },
    });
  }
);

// @desc    Cancel reservation before expiry
// @route   POST /api/v1/bookings/:bookingId/cancel-reservation
// @access  Private
export const cancelReservation = asyncHandler(async (req, res, next) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new ErrorResponse("Không tìm thấy booking", 404));
  }

  // Check if user owns this booking
  if (booking.user.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new ErrorResponse("Không có quyền hủy booking này", 403));
  }

  // Check if booking is still in reserved status
  if (booking.status !== "reserved") {
    return next(
      new ErrorResponse(
        "Chỉ có thể hủy booking đang ở trạng thái reserved",
        400
      )
    );
  }

  // Cancel the booking
  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  booking.cancellationReason = "Cancelled by user";
  await booking.save();

  // Also cancel related payment session
  await PaymentSession.updateOne({ bookingId }, { status: "expired" });

  res.status(200).json({
    success: true,
    data: {
      bookingId,
      status: "cancelled",
      message: "Reservation cancelled successfully",
    },
  });
});

// @desc    Get booking details
// @route   GET /api/v1/bookings/:bookingId
// @access  Private
export const getBookingDetails = asyncHandler(async (req, res, next) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId)
    .populate({
      path: "court",
      select: "courtName sportType",
      populate: {
        path: "venue",
        select: "name address phoneNumber",
      },
    })
    .populate("user", "name email phoneNumber");

  if (!booking) {
    return next(new ErrorResponse("Không tìm thấy booking", 404));
  }

  // Check if user has permission to view this booking
  if (
    booking.user._id.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(new ErrorResponse("Không có quyền truy cập booking này", 403));
  }

  res.status(200).json({
    success: true,
    data: {
      id: booking._id,
      courtId: booking.court._id,
      courtName: booking.court.courtName,
      venue: {
        name: booking.court.venue.name,
        address: booking.court.venue.address,
        phone: booking.court.venue.phoneNumber,
      },
      date: booking.date,
      timeSlots: booking.timeSlots,
      courtQuantity: booking.courtQuantity,
      totalPrice: booking.totalAmount,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      transactionId: booking.paymentId,
      customerInfo: booking.customerInfo,
      createdAt: booking.createdAt,
      paidAt: booking.paidAt,
      reservedAt: booking.reservedAt,
      confirmedAt: booking.confirmedAt,
      reservationExpiresAt: booking.reservationExpiresAt,
    },
  });
});

// Helper function to check court availability
const checkCourtAvailability = async (courtId, date, timeSlots) => {
  const now = new Date();

  const conflicts = await Booking.find({
    court: courtId,
    date: new Date(date),
    status: { $in: ["reserved", "confirmed"] },
  }).populate("user", "_id");

  // Filter out expired reservations and check for time slot overlaps
  const activeConflicts = conflicts
    .filter((booking) => {
      // Always include confirmed bookings
      if (booking.status === "confirmed") return true;

      // For reserved bookings, check if not expired
      if (booking.status === "reserved") {
        return new Date(booking.reservationExpiresAt) > now;
      }

      return false;
    })
    .filter((booking) => {
      // Check if any of the requested time slots overlap with this booking
      return booking.timeSlots.some((bookingSlot) =>
        timeSlots.some((requestedSlot) =>
          timeSlotsOverlap(requestedSlot, bookingSlot)
        )
      );
    });

  return activeConflicts;
};

// Helper function to check if two time slots overlap
const timeSlotsOverlap = (slot1, slot2) => {
  const start1 = timeToMinutes(slot1.start);
  const end1 = timeToMinutes(slot1.end);
  const start2 = timeToMinutes(slot2.start);
  const end2 = timeToMinutes(slot2.end);

  return start1 < end2 && end1 > start2;
};

// Helper function to convert time string to minutes
const timeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

// Helper function to calculate slot price (implement based on your business logic)
const calculateSlotPrice = (court, slot) => {
  // Simple implementation - you can make this more complex
  return (
    court.pricing?.find((p) => p.timeRange?.includes(slot.start))?.price ||
    100000
  );
};

// Payment gateway helper functions
const createVNPayURL = async (paymentSession, booking, court, venue) => {
  const vnp_Params = {};
  const createDate = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "");

  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = PAYMENT_CONFIG.vnpay.vnp_TmnCode;
  vnp_Params["vnp_Locale"] = "vn";
  vnp_Params["vnp_CurrCode"] = "VND";
  vnp_Params["vnp_TxnRef"] = paymentSession.id;
  vnp_Params[
    "vnp_OrderInfo"
  ] = `Thanh toan dat san ${court.courtName} - ${venue.name}`;
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = paymentSession.amount * 100;
  vnp_Params["vnp_ReturnUrl"] = PAYMENT_CONFIG.vnpay.vnp_ReturnUrl;
  vnp_Params["vnp_IpAddr"] = "127.0.0.1";
  vnp_Params["vnp_CreateDate"] = createDate;

  const sortedParams = sortObject(vnp_Params);
  const signData = querystring.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac("sha512", PAYMENT_CONFIG.vnpay.vnp_HashSecret);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;

  const paymentUrl =
    PAYMENT_CONFIG.vnpay.vnp_Url +
    "?" +
    querystring.stringify(vnp_Params, { encode: false });

  return { paymentUrl };
};

const createMoMoURL = async (paymentSession, booking, court, venue) => {
  const orderId = paymentSession.id;
  const requestId = `${orderId}_${Date.now()}`;
  const orderInfo = `Thanh toan dat san ${court.courtName} - ${venue.name}`;
  const redirectUrl = PAYMENT_CONFIG.momo.redirectUrl;
  const ipnUrl = PAYMENT_CONFIG.momo.ipnUrl;
  const amount = paymentSession.amount.toString();
  const extraData = "";
  const requestType = "payWithATM";
  const autoCapture = true;
  const lang = "vi";

  const rawSignature = `accessKey=${PAYMENT_CONFIG.momo.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${PAYMENT_CONFIG.momo.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

  const signature = crypto
    .createHmac("sha256", PAYMENT_CONFIG.momo.secretKey)
    .update(rawSignature)
    .digest("hex");

  const requestBody = {
    partnerCode: PAYMENT_CONFIG.momo.partnerCode,
    partnerName: "VIC Sports",
    storeId: "MomoTestStore",
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang,
    requestType,
    autoCapture,
    extraData,
    signature,
  };

  const response = await axios.post(PAYMENT_CONFIG.momo.endpoint, requestBody);
  return response.data;
};

const createZaloPayURL = async (paymentSession, booking, court, venue) => {
  const transId = Math.floor(Math.random() * 1000000);

  const orderData = {
    app_id: parseInt(PAYMENT_CONFIG.zalopay.appId),
    app_trans_id: paymentSession.id,
    app_user: booking.user.toString(),
    app_time: Date.now(),
    amount: paymentSession.amount,
    description: `VIC Sports - Thanh toan dat san ${court.courtName}`,
    bank_code: "",
    item: JSON.stringify([
      {
        name: court.courtName,
        quantity: booking.courtQuantity,
        price: paymentSession.amount / booking.courtQuantity,
      },
    ]),
    embed_data: JSON.stringify({
      redirecturl: PAYMENT_CONFIG.zalopay.callbackUrl,
    }),
    callback_url: PAYMENT_CONFIG.zalopay.callbackUrl,
  };

  const data = `${orderData.app_id}|${orderData.app_trans_id}|${orderData.app_user}|${orderData.amount}|${orderData.app_time}|${orderData.embed_data}|${orderData.item}`;
  orderData.mac = crypto
    .createHmac("sha256", PAYMENT_CONFIG.zalopay.key1)
    .update(data)
    .digest("hex");

  const response = await axios.post(PAYMENT_CONFIG.zalopay.endpoint, orderData);
  return response.data;
};

// Utility function to sort object
const sortObject = (obj) => {
  const sorted = {};
  const str = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (let key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
};
