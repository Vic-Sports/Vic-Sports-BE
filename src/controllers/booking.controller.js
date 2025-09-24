import Booking from "../models/booking.js";
import Court from "../models/court.js";
import Venue from "../models/venue.js";
import User from "../models/user.js";
import Coach from "../models/coach.js";

// @desc    Create Booking (Updated for FE Multi-Court Logic)
// @route   POST /api/bookings
// @access Private
export const createBooking = async (req, res) => {
  try {
    const {
      courtIds, // Array of court IDs for multi-court booking
      userId, // Optional: if not provided, use req.user.id
      date, // "YYYY-MM-DD" format
      timeSlots, // Array of time slots with start, end, price
      totalPrice, // Total price for all courts and slots
      venue, // Venue ID
      customerInfo, // Customer information object
      paymentMethod = "vnpay",
      notes,
    } = req.body;

    // Use provided userId or fallback to authenticated user
    const bookingUserId = userId || req.user?.id;

    // Validate required fields
    if (!courtIds || !Array.isArray(courtIds) || courtIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Court IDs are required and must be an array",
      });
    }

    if (!date || !timeSlots || !totalPrice || !venue || !customerInfo) {
      return res.status(400).json({
        success: false,
        message:
          "Date, timeSlots, totalPrice, venue, and customerInfo are required",
      });
    }

    // Validate customer info
    if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.email) {
      return res.status(400).json({
        success: false,
        message: "Customer fullName, phone, and email are required",
      });
    }

    // Validate all courts exist and belong to the venue
    const courts = await Court.find({
      _id: { $in: courtIds },
      venueId: venue,
      isActive: true,
    });

    if (courts.length !== courtIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more courts not found or inactive",
      });
    }

    // Check availability for all courts and time slots
    for (const courtId of courtIds) {
      for (const timeSlot of timeSlots) {
        const isAvailable = await checkCourtAvailabilityForSlot(
          courtId,
          date,
          timeSlot.start,
          timeSlot.end
        );

        if (!isAvailable) {
          return res.status(409).json({
            success: false,
            message: `Court ${courtId} is not available for ${timeSlot.start}-${timeSlot.end}`,
          });
        }
      }
    }

    // Create booking object
    const bookingData = {
      venue,
      date,
      timeSlots,
      totalPrice,
      customerInfo: {
        fullName: customerInfo.fullName,
        phone: customerInfo.phone,
        email: customerInfo.email,
        notes: customerInfo.notes || notes,
      },
      paymentMethod,
      paymentStatus: "pending",
      status: "pending",
      courtQuantity: courtIds.length,
    };

    // Handle single vs multi-court booking
    if (courtIds.length === 1) {
      bookingData.court = courtIds[0];
      bookingData.isGroupBooking = false;
    } else {
      bookingData.courtIds = courtIds;
      bookingData.isGroupBooking = true;
      bookingData.groupBookingId = `group_${Date.now()}`;
    }

    // Add user if provided
    if (bookingUserId) {
      bookingData.user = bookingUserId;
    }

    const booking = await Booking.create(bookingData);

    // Populate the booking with court and venue details
    const populatedBooking = await Booking.findById(booking._id)
      .populate("court", "name sportType")
      .populate("courtIds", "name sportType")
      .populate("venue", "name address")
      .populate("user", "fullName email phone");

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: {
        booking: populatedBooking,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
