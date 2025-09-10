import Booking from "../models/booking.js";
import Court from "../models/court.js";
import Venue from "../models/venue.js";
import User from "../models/user.js";
import Coach from "../models/coach.js";

// @desc    Create Booking
// @route   POST /api/bookings
// @access Private
export const createBooking = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      courtId,
      venueId,
      bookingDate,
      timeSlot,
      duration,
      coachId,
      customerNotes,
      contactPhone,
      contactEmail,
    } = req.body;

    // Validate required fields
    if (!courtId || !venueId || !bookingDate || !timeSlot || !duration) {
      return res.status(400).json({
        success: false,
        message: "Court ID, venue ID, booking date, time slot, and duration are required",
      });
    }

    // Check if court exists and is active
    const court = await Court.findById(courtId);
    if (!court || !court.isActive) {
      return res.status(404).json({
        success: false,
        message: "Court not found or inactive",
      });
    }

    // Check if venue exists and is active
    const venue = await Venue.findById(venueId);
    if (!venue || !venue.isActive) {
      return res.status(404).json({
        success: false,
        message: "Venue not found or inactive",
      });
    }

    // Check court availability
    const availability = await checkCourtAvailability(courtId, bookingDate, timeSlot.start, timeSlot.end);
    if (!availability.available) {
      return res.status(400).json({
        success: false,
        message: "Court is not available at the requested time",
      });
    }

    // Calculate pricing
    const pricing = await calculateBookingPrice(courtId, bookingDate, timeSlot.start, timeSlot.end);
    if (!pricing) {
      return res.status(400).json({
        success: false,
        message: "Unable to calculate pricing for the requested time",
      });
    }

    // Calculate coach fee if coach is selected
    let coachFee = 0;
    if (coachId) {
      const coach = await User.findById(coachId);
      if (coach && coach.role === "coach") {
        // Get coach profile and calculate fee
        const coachProfile = await Coach.findOne({ userId: coachId });
        if (coachProfile) {
          coachFee = coachProfile.hourlyRate * (duration / 60);
        }
      }
    }

    // Calculate total price
    const totalPrice = pricing.pricePerHour * (duration / 60) + coachFee;
    const finalPrice = totalPrice; // Apply discounts later

    // Create booking
    const booking = await Booking.create({
      customerId,
      courtId,
      venueId,
      bookingDate: new Date(bookingDate),
      timeSlot,
      duration,
      pricePerHour: pricing.pricePerHour,
      totalPrice,
      coachFee,
      finalPrice,
      coachId,
      customerNotes,
      contactPhone: contactPhone || req.user.phone,
      contactEmail: contactEmail || req.user.email,
      status: "pending",
      paymentStatus: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
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

// @desc    Get User Bookings
// @route   GET /api/bookings
// @access Private
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "bookingDate",
      sortOrder = "desc",
    } = req.query;

    const query = { customerId: userId };

    // Filter by status
    if (status) {
      query.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const bookings = await Booking.find(query)
      .populate("courtId", "name sportType")
      .populate("venueId", "name address")
      .populate("coachId", "fullName")
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

// @desc    Get Booking by ID
// @route   GET /api/bookings/:bookingId
// @access Private
export const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId)
      .populate("customerId", "fullName email phone")
      .populate("courtId", "name sportType capacity")
      .populate("venueId", "name address contactInfo")
      .populate("coachId", "fullName phone");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user is authorized to view this booking
    if (!booking.customerId._id.equals(userId) && req.user.role !== "admin") {
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

// @desc    Cancel Booking
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
    if (!booking.customerId.equals(userId) && req.user.role !== "admin") {
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

    // Calculate cancellation policy
    const hoursUntilBooking = (new Date(booking.bookingDate) - new Date()) / (1000 * 60 * 60);
    let refundAmount = 0;

    if (hoursUntilBooking > 24) {
      refundAmount = booking.finalPrice; // Full refund
    } else if (hoursUntilBooking > 2) {
      refundAmount = booking.finalPrice * 0.5; // 50% refund
    } else {
      refundAmount = 0; // No refund
    }

    // Update booking
    booking.status = "cancelled";
    booking.cancellationReason = reason;
    booking.cancelledBy = userId;
    booking.cancelledAt = new Date();

    if (refundAmount > 0) {
      booking.paymentStatus = "refunded";
    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: {
        booking: {
          id: booking._id,
          status: booking.status,
          cancellationReason: booking.cancellationReason,
          refundAmount,
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

// @desc    Reschedule Booking
// @route   PUT /api/bookings/:bookingId/reschedule
// @access Private
export const rescheduleBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const { newBookingDate, newTimeSlot } = req.body;

    if (!newBookingDate || !newTimeSlot) {
      return res.status(400).json({
        success: false,
        message: "New booking date and time slot are required",
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user is authorized to reschedule this booking
    if (!booking.customerId.equals(userId) && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reschedule this booking",
      });
    }

    // Check if booking can be rescheduled
    if (booking.status !== "confirmed" && booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only confirmed or pending bookings can be rescheduled",
      });
    }

    // Check new time availability
    const availability = await checkCourtAvailability(
      booking.courtId,
      newBookingDate,
      newTimeSlot.start,
      newTimeSlot.end
    );

    if (!availability.available) {
      return res.status(400).json({
        success: false,
        message: "Court is not available at the new requested time",
      });
    }

    // Update booking
    booking.bookingDate = new Date(newBookingDate);
    booking.timeSlot = newTimeSlot;
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking rescheduled successfully",
      data: {
        booking: {
          id: booking._id,
          bookingDate: booking.bookingDate,
          timeSlot: booking.timeSlot,
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

// @desc    Check-in to Booking
// @route   PUT /api/bookings/:bookingId/checkin
// @access Private
export const checkInBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user is authorized to check-in
    if (!booking.customerId.equals(userId) && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to check-in to this booking",
      });
    }

    if (booking.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Only confirmed bookings can be checked-in",
      });
    }

    if (booking.checkedIn) {
      return res.status(400).json({
        success: false,
        message: "Booking is already checked-in",
      });
    }

    booking.checkedIn = true;
    booking.checkedInAt = new Date();
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Checked-in successfully",
      data: {
        booking: {
          id: booking._id,
          checkedIn: booking.checkedIn,
          checkedInAt: booking.checkedInAt,
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

// @desc    Check-out from Booking
// @route   PUT /api/bookings/:bookingId/checkout
// @access Private
export const checkOutBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user is authorized to check-out
    if (!booking.customerId.equals(userId) && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to check-out from this booking",
      });
    }

    if (!booking.checkedIn) {
      return res.status(400).json({
        success: false,
        message: "Must check-in before checking out",
      });
    }

    if (booking.checkedOut) {
      return res.status(400).json({
        success: false,
        message: "Booking is already checked-out",
      });
    }

    booking.checkedOut = true;
    booking.checkedOutAt = new Date();
    booking.status = "completed";
    await booking.save();

    // Award points to customer
    const customer = await User.findById(booking.customerId);
    if (customer) {
      const pointsEarned = User.calculateRewardPoints(booking.finalPrice, customer.loyaltyTier);
      customer.addPoints(pointsEarned, "booking");
      customer.totalBookings += 1;
      customer.totalSpent += booking.finalPrice;
      await customer.save();

      booking.pointsEarned = pointsEarned;
      await booking.save();
    }

    res.status(200).json({
      success: true,
      message: "Checked-out successfully",
      data: {
        booking: {
          id: booking._id,
          checkedOut: booking.checkedOut,
          checkedOutAt: booking.checkedOutAt,
          status: booking.status,
          pointsEarned: booking.pointsEarned,
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

// @desc    Search Available Courts
// @route   GET /api/bookings/search
// @access Public
export const searchAvailableCourts = async (req, res) => {
  try {
    const {
      sportType,
      city,
      district,
      date,
      startTime,
      endTime,
      minPrice,
      maxPrice,
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

    // Filter by location through venue
    if (city || district) {
      const venueQuery = { isActive: true, isVerified: true };
      if (city) venueQuery["address.city"] = city;
      if (district) venueQuery["address.district"] = district;

      const venues = await Venue.find(venueQuery).select("_id");
      const venueIds = venues.map(venue => venue._id);
      query.venueId = { $in: venueIds };
    }

    const courts = await Court.find(query)
      .populate("venueId", "name address ratings")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter by availability and pricing
    const availableCourts = [];
    for (const court of courts) {
      const availability = await checkCourtAvailability(court._id, date, startTime, endTime);
      if (availability.available) {
        const pricing = await calculateBookingPrice(court._id, date, startTime, endTime);
        if (pricing) {
          const totalPrice = pricing.pricePerHour * ((new Date(`2000-01-01 ${endTime}`) - new Date(`2000-01-01 ${startTime}`)) / (1000 * 60 * 60));
          
          // Filter by price range
          if (minPrice && totalPrice < minPrice) continue;
          if (maxPrice && totalPrice > maxPrice) continue;

          availableCourts.push({
            ...court.toObject(),
            availability,
            pricing: {
              ...pricing,
              totalPrice,
            },
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        courts: availableCourts,
        searchParams: {
          sportType,
          city,
          district,
          date,
          startTime,
          endTime,
          minPrice,
          maxPrice,
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

// Helper function to check court availability
const checkCourtAvailability = async (courtId, date, startTime, endTime) => {
  const court = await Court.findById(courtId);
  if (!court) return { available: false, reason: "Court not found" };

  const requestedDate = new Date(date);
  const dayOfWeek = requestedDate.getDay();

  const dayAvailability = court.defaultAvailability.find(
    day => day.dayOfWeek === dayOfWeek
  );

  if (!dayAvailability) {
    return { available: false, reason: "Court not available on this day" };
  }

  const availableSlots = dayAvailability.timeSlots.filter(slot => 
    slot.isAvailable && 
    slot.start >= startTime && 
    slot.end <= endTime
  );

  return {
    available: availableSlots.length > 0,
    timeSlots: availableSlots,
  };
};

// Helper function to calculate booking price
const calculateBookingPrice = async (courtId, date, startTime, endTime) => {
  const court = await Court.findById(courtId);
  if (!court) return null;

  let dayType = "weekday";
  const requestedDate = new Date(date);
  const dayOfWeek = requestedDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    dayType = "weekend";
  }

  const applicablePricing = court.pricing.find(price => {
    if (!price.isActive) return false;
    if (price.dayType && price.dayType !== dayType) return false;
    return startTime >= price.timeSlot.start && endTime <= price.timeSlot.end;
  });

  return applicablePricing ? {
    pricePerHour: applicablePricing.pricePerHour,
    dayType: applicablePricing.dayType,
  } : null;
};
