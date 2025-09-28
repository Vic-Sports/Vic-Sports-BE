import Booking from "../models/booking.js";
import Court from "../models/court.js";
import Venue from "../models/venue.js";
import User from "../models/user.js";
import Coach from "../models/coach.js";
import payosService from "../services/payos.service.js";
import payosService from "../services/payos.service.js";

// @desc    Create Booking (Updated for FE Multi-Court Logic)
// @route   POST /api/bookings
// @access Private
export const createBooking = async (req, res) => {
  try {
    console.log("=== CREATE BOOKING REQUEST ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      venueId,
      courtIds,
      date,
      timeSlots,
      paymentMethod,
      notes,
      paymentInfo,
    } = req.body;
    const userId = req.user?.id;

    console.log("Extracted data:", {
      venueId,
      courtIds,
      date,
      timeSlots,
      paymentMethod,
      paymentInfo,
      userId,
    });

    // Validation
    if (!venueId) {
      return res.status(400).json({
        success: false,
        message: "Venue ID is required",
      });
    }

    // Support both single court (courtId) and multiple courts (courtIds)
    let courtIdsArray = [];
    if (req.body.courtId) {
      // Backward compatibility for single court
      courtIdsArray = [req.body.courtId];
    } else if (courtIds && Array.isArray(courtIds) && courtIds.length > 0) {
      courtIdsArray = courtIds;
    } else {
      return res.status(400).json({
        success: false,
        message: "Court ID(s) are required",
      });
    }

    if (
      !date ||
      !timeSlots ||
      !Array.isArray(timeSlots) ||
      timeSlots.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Date and time slots are required",
      });
    }

    // Verify venue exists
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    // Verify all courts exist and belong to venue
    console.log("Looking for courts:", { courtIdsArray, venueId });
    const courts = await Court.find({
      _id: { $in: courtIdsArray },
      venueId: venueId,
    });
    console.log(
      "Found courts:",
      courts.length,
      "Expected:",
      courtIdsArray.length
    );

    if (courts.length !== courtIdsArray.length) {
      console.log("Court validation failed:");
      console.log("- Requested court IDs:", courtIdsArray);
      console.log(
        "- Found courts:",
        courts.map((c) => ({ id: c._id, name: c.name, venueId: c.venueId }))
      );

      return res.status(404).json({
        success: false,
        message: "One or more courts not found or do not belong to this venue",
        debug: {
          requestedCourts: courtIdsArray,
          foundCourts: courts.map((c) => c._id),
          venueId: venueId,
        },
      });
    }

    // Check availability for all courts and time slots
    const bookingDate = new Date(date);
    const existingBookings = await Booking.find({
      court: { $in: courtIdsArray },
      date: bookingDate,
      timeSlots: { $in: timeSlots },
      status: { $in: ["CONFIRMED", "PENDING"] },
    });

    if (existingBookings.length > 0) {
      const conflictDetails = existingBookings.map((booking) => ({
        court: booking.court,
        timeSlots: booking.timeSlots,
        bookingCode: booking.bookingCode,
      }));

      return res.status(400).json({
        success: false,
        message: "Some time slots are already booked",
        conflicts: conflictDetails,
      });
    }

    // Get customer info from authenticated user or create fallback
    let customerInfo;
    if (userId) {
      const user = await User.findById(userId);
      customerInfo = {
        fullName: user?.fullName || "Guest User",
        phone: user?.phone || "0000000000",
        email: user?.email || "guest@example.com",
        notes: notes || "",
      };
    } else {
      // Fallback customer info for guest bookings
      customerInfo = {
        fullName: "Guest User",
        phone: "0000000000",
        email: "guest@example.com",
        notes: notes || "",
      };
    }

    // Transform timeSlots data format (startTime/endTime -> start/end)
    const transformedTimeSlots = timeSlots.map((slot) => ({
      start: slot.startTime || slot.start,
      end: slot.endTime || slot.end,
      price: slot.price || 0,
    }));

    console.log("Original timeSlots:", timeSlots);
    console.log("Transformed timeSlots:", transformedTimeSlots);

    // Calculate total amount from timeSlots instead of court pricePerHour
    let totalAmount = 0;
    transformedTimeSlots.forEach((slot) => {
      if (slot.price) {
        totalAmount += slot.price * courtIdsArray.length; // Multiply by number of courts
      }
    });

    // If no price in timeSlots, try to get from courts
    if (totalAmount === 0) {
      courts.forEach((court) => {
        // Try to get price from court's pricing array or default
        let courtPrice = 200000; // Default price
        if (court.pricing && court.pricing.length > 0) {
          courtPrice = court.pricing[0].pricePerHour || 200000;
        }
        totalAmount += courtPrice * transformedTimeSlots.length;
      });
    }

    console.log("Customer info:", customerInfo);
    console.log("Total amount calculated:", totalAmount);

    // Create bookings for each court
    const bookings = [];
    const paymentLinks = []; // Array to collect payment links
    const groupBookingCode = `VIC${Date.now()}`;

    for (let i = 0; i < courts.length; i++) {
      const court = courts[i];

      // Calculate individual court amount
      let individualAmount = 0;
      transformedTimeSlots.forEach((slot) => {
        individualAmount += slot.price || 200000; // Use slot price or default
      });

      const bookingData = {
        bookingCode:
          courts.length === 1
            ? groupBookingCode
            : `${groupBookingCode}-${i + 1}`,
        user: userId || undefined,
        venue: venueId,
        court: court._id,
        courtIds: courtIdsArray, // Lưu mảng courtIds vào DB
        date: date, // Use string format as expected by model
        timeSlots: transformedTimeSlots,
        courtQuantity: courts.length,
        totalPrice: totalAmount, // Add required totalPrice field
        customerInfo, // Add required customerInfo
        duration: transformedTimeSlots.length,
        status: "pending", // Use lowercase enum value
        paymentStatus: "pending", // Use lowercase enum value
        paymentMethod: paymentMethod?.toLowerCase() || "vnpay", // Ensure lowercase
        notes,
        groupBookingCode: courts.length > 1 ? groupBookingCode : undefined,
      };

      // Nếu sử dụng PayOS, tạo payment link
      let paymentLink = null;
      if (paymentMethod?.toLowerCase() === "payos" && paymentInfo) {
        console.log("Creating PayOS payment link for court:", court.name);

        try {
          const paymentData = {
            orderCode: Math.floor(Date.now() / 1000) + i, // Unique order code for each court
            amount: individualAmount,
            description: `Đặt sân ${court.name} - ${date} - ${transformedTimeSlots.length} giờ`,
            items: [
              {
                name: `${court.name} - ${transformedTimeSlots.length} giờ`,
                quantity: 1,
                price: individualAmount,
              },
            ],
            returnUrl:
              paymentInfo.returnUrl || "http://localhost:5173/booking/success",
            cancelUrl:
              paymentInfo.cancelUrl || "http://localhost:5173/booking/cancel",
            buyerName: customerInfo?.fullName,
            buyerEmail: customerInfo?.email,
            buyerPhone: customerInfo?.phone,
          };

          console.log("PayOS payment data:", paymentData);

          const paymentResult = await payosService.createPaymentLink(
            paymentData
          );
          console.log("PayOS payment result:", paymentResult);

          if (paymentResult.success && paymentResult.data) {
            // Kiểm tra PayOS response code
            if (paymentResult.data.code && paymentResult.data.code !== "00") {
              console.warn(
                "PayOS returned error code:",
                paymentResult.data.code,
                paymentResult.data.desc
              );

              // Nếu là lỗi PayOS, vẫn tạo booking nhưng không có payment link
              console.log(
                "Creating booking without payment link due to PayOS error"
              );
              bookingData.payosOrderCode = paymentData.orderCode;
              bookingData.payosError = {
                code: paymentResult.data.code,
                desc: paymentResult.data.desc,
              };
            } else {
              // PayOS success - có payment link
              paymentLink =
                paymentResult.data.data?.checkoutUrl ||
                paymentResult.data.checkoutUrl;
              bookingData.payosOrderCode = paymentData.orderCode;
              bookingData.payosPaymentLinkId =
                paymentResult.data.data?.paymentLinkId;
            }
          } else {
            console.error(
              "PayOS service error:",
              paymentResult.error || paymentResult
            );
            // Vẫn tạo booking nhưng không có PayOS info
            console.log("Creating booking without PayOS due to service error");
          }
        } catch (payosError) {
          console.error("PayOS payment creation error:", payosError);
          return res.status(400).json({
            success: false,
            message: "Không thể tạo link thanh toán PayOS",
            error: payosError.message,
          });
        }
      }

      console.log(
        "Creating booking with data:",
        JSON.stringify(bookingData, null, 2)
      );

      const booking = await Booking.create(bookingData);
      bookings.push(booking);

      // Lưu payment link nếu có
      if (paymentLink) {
        paymentLinks.push({
          bookingId: booking._id,
          paymentUrl: paymentLink,
          orderCode: bookingData.payosOrderCode,
        });
      }
    } // Populate booking data
    const populatedBookings = await Booking.find({
      _id: { $in: bookings.map((b) => b._id) },
    })
      .populate("venue", "name address phone email")
      .populate("court", "name type pricePerHour")
      .populate("user", "fullName email phone");

    // Return format compatible with single booking
    if (courts.length === 1) {
      const response = {
        success: true,
        data: {
          booking: populatedBookings[0],
        },
        message: "Booking created successfully",
      };

      // Thêm thông tin thanh toán nếu có
      if (paymentLinks.length > 0) {
        response.data.payment = {
          method: paymentMethod,
          paymentUrl: paymentLinks[0].paymentUrl,
          orderCode: paymentLinks[0].orderCode,
        };
      } else if (populatedBookings[0].payosError) {
        // Thêm thông tin lỗi PayOS
        response.data.payosError = populatedBookings[0].payosError;
        response.message =
          "Booking created but PayOS payment failed: " +
          populatedBookings[0].payosError.desc;
      }

      res.status(201).json(response);
    } else {
      const response = {
        success: true,
        data: {
          bookings: populatedBookings,
          totalAmount,
          groupBookingCode,
          bookingCount: bookings.length,
        },
        message: `Successfully created ${bookings.length} bookings`,
      };

      // Thêm thông tin thanh toán nếu có
      if (paymentLinks.length > 0) {
        response.data.payments = paymentLinks;
      }

      res.status(201).json(response);
    }
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// @desc    Get User Bookings (Updated)
// @route   GET /api/bookings
// @access Private
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { user: userId };

    // Filter by status
    if (status) {
      query.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const bookings = await Booking.find(query)
      .populate("court", "name sportType")
      .populate("courtIds", "name sportType")
      .populate("venue", "name address")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalBookings: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Booking by ID (Updated)
// @route   GET /api/bookings/:bookingId
// @access Private
export const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId)
      .populate("user", "fullName email phone")
      .populate("court", "name sportType capacity")
      .populate("courtIds", "name sportType capacity")
      .populate("venue", "name address contactInfo");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user is authorized to view this booking
    if (
      booking.user &&
      !booking.user._id.equals(userId) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this booking",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        booking,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Cancel Booking (Simplified)
// @route   PUT /api/bookings/:bookingId/cancel
// @access Private
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user is authorized to cancel this booking
    if (
      booking.user &&
      !booking.user.equals(userId) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this booking",
      });
    }

    // Check if booking can be cancelled
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
      });
    }

    if (booking.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel completed booking",
      });
    }

    // Update booking
    booking.status = "cancelled";
    booking.cancellationReason = reason;
    booking.cancelledAt = new Date();

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: {
        booking: {
          id: booking._id,
          status: booking.status,
          cancellationReason: booking.cancellationReason,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Search Available Courts (Simplified for FE)
// @route   GET /api/bookings/search
// @access Public
export const searchAvailableCourts = async (req, res) => {
  try {
    const {
      sportType,
      venueId,
      date,
      startTime,
      endTime,
      page = 1,
      limit = 10,
    } = req.query;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Date, start time, and end time are required",
      });
    }

    const query = { isActive: true };

    // Filter by sport type
    if (sportType) {
      query.sportType = sportType;
    }

    // Filter by venue
    if (venueId) {
      query.venueId = venueId;
    }

    const courts = await Court.find(query)
      .populate("venueId", "name address ratings")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter by availability
    const availableCourts = [];
    for (const court of courts) {
      const isAvailable = await checkCourtAvailabilityForSlot(
        court._id,
        date,
        startTime,
        endTime
      );

      if (isAvailable) {
        availableCourts.push(court);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        courts: availableCourts,
        searchParams: {
          sportType,
          venueId,
          date,
          startTime,
          endTime,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Helper function to check court availability for specific slot
const checkCourtAvailabilityForSlot = async (
  courtId,
  date,
  startTime,
  endTime
) => {
  try {
    const existingBookings = await Booking.find({
      $or: [
        { court: courtId }, // Single court booking
        { courtIds: courtId }, // Multi-court booking
      ],
      date: date,
      status: { $in: ["confirmed", "pending"] },
    });

    // Check if any existing booking conflicts with the requested time slot
    const hasConflict = existingBookings.some((booking) => {
      return booking.timeSlots.some((timeSlot) =>
        isTimeSlotOverlap(startTime, endTime, timeSlot.start, timeSlot.end)
      );
    });

    return !hasConflict;
  } catch (error) {
    console.error("Error checking court availability:", error);
    return false;
  }
};

// Helper function to check time slot overlap
const isTimeSlotOverlap = (start1, end1, start2, end2) => {
  const timeToMinutes = (timeString) => {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return s1 < e2 && e1 > s2;
};

// @desc    Test Booking Creation (For Backend Testing)
// @route   POST /api/bookings/test
// @access  Public
export const testBookingCreation = async (req, res) => {
  try {
    console.log("=== TEST BOOKING CREATION ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    // Test data with realistic values
    const testData = {
      venue: "676b2d123456789012345678", // Default venue ID
      date: "2024-12-20",
      timeSlots: [
        { start: "09:00", end: "10:00", price: 150000 },
        { start: "10:00", end: "11:00", price: 150000 },
      ],
      totalPrice: 300000,
      customerInfo: {
        fullName: "Test Customer",
        phone: "0123456789",
        email: "test@example.com",
      },
      paymentMethod: "vnpay",
      paymentStatus: "pending",
      status: "confirmed",
      court: "676b2d123456789012345679", // Default court ID
      isGroupBooking: false,
      courtQuantity: 1,
      notes: "Test booking from backend",
    };

    const booking = await Booking.create(testData);
    console.log("Test booking created successfully:", booking._id);

    res.status(201).json({
      success: true,
      data: {
        paymentUrl: null,
        paymentRef: booking.bookingCode || `BK${Date.now()}`,
      },
      booking: {
        _id: booking._id,
        bookingId: booking.bookingCode,
        venue: booking.venue,
        date: booking.date,
        timeSlots: booking.timeSlots,
        totalPrice: booking.totalPrice,
        customerInfo: booking.customerInfo,
        paymentMethod: booking.paymentMethod,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        bookingRef: booking.bookingCode || `BK${Date.now()}`,
        createdAt: booking.createdAt,
      },
    });
  } catch (error) {
    console.error("Test booking error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create Simple Booking (No Validation - For Frontend Testing)
// @route   POST /api/bookings/simple
// @access  Public
export const createSimpleBooking = async (req, res) => {
  try {
    console.log("=== CREATE SIMPLE BOOKING ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      courtIds,
      venue,
      date,
      timeSlots,
      totalPrice,
      customerInfo,
      paymentMethod = "vnpay",
      notes,
    } = req.body;

    // Create booking object (bypass validation)
    const bookingData = {
      venue: venue || "676b2d123456789012345678", // Default venue ID
      date,
      timeSlots,
      totalPrice,
      customerInfo,
      paymentMethod,
      paymentStatus: "pending",
      status: "confirmed",
      courtQuantity: courtIds?.length || 1,
      notes,
    };

    // Handle courts without validation
    if (courtIds && courtIds.length === 1) {
      bookingData.court = "676b2d123456789012345679"; // Default court ID
      bookingData.isGroupBooking = false;
    } else if (courtIds && courtIds.length > 1) {
      bookingData.courtIds = [
        "676b2d123456789012345679",
        "676b2d123456789012345680",
      ];
      bookingData.isGroupBooking = true;
      bookingData.groupBookingId = `group_${Date.now()}`;
    } else {
      bookingData.court = "676b2d123456789012345679"; // Default court ID
      bookingData.isGroupBooking = false;
    }

    const booking = await Booking.create(bookingData);
    console.log("Booking created successfully:", booking._id);

    // Trả về response đơn giản
    res.status(201).json({
      success: true,
      data: {
        paymentUrl: null,
        paymentRef: booking.bookingCode,
      },
      booking: {
        _id: booking._id,
        bookingId: booking.bookingCode,
        venue: booking.venue,
        date: booking.date,
        timeSlots: booking.timeSlots,
        totalPrice: booking.totalPrice,
        customerInfo: booking.customerInfo,
        paymentMethod: booking.paymentMethod,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        bookingRef: booking.bookingCode,
        createdAt: booking.createdAt,
      },
      // Để frontend dễ truy cập
      bookingId: booking._id,
    });
  } catch (error) {
    console.error("Simple booking error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
