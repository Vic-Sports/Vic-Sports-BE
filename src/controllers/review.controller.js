import Review from "../models/review.js";
import Booking from "../models/booking.js";
import Venue from "../models/venue.js";
import Court from "../models/court.js";
import mongoose from "mongoose";

// @desc    Create Review
// @route   POST /api/reviews
// @access Private
export const createReview = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      bookingId,
      overallRating,
      detailRatings,
      comment,
      images,
      coachRating,
      coachComment,
    } = req.body;

    // Validate required fields
    if (!bookingId || !overallRating) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and overall rating are required",
      });
    }

    // Check if booking exists and belongs to user
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (!booking.customerId.equals(customerId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to review this booking",
      });
    }

    // Check if booking is completed
    if (booking.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Can only review completed bookings",
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ bookingId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "Review already exists for this booking",
      });
    }

    // Create review
    const review = await Review.create({
      bookingId,
      customerId,
      venueId: booking.venueId,
      courtId: booking.courtId,
      overallRating,
      detailRatings,
      comment,
      images,
      coachId: booking.coachId,
      coachRating,
      coachComment,
    });

    // Update venue and court ratings
    await updateRatings(booking.venueId, booking.courtId);

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: {
        review,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Reviews by Venue
// @route   GET /api/reviews/venue/:venueId
// @access Public
export const getReviewsByVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { page = 1, limit = 10, rating, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const query = { venueId, isApproved: true };

    // Filter by rating
    if (rating) {
      query.overallRating = parseInt(rating);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const reviews = await Review.find(query)
      .populate("customerId", "fullName avatar")
      .populate("courtId", "name sportType")
      .populate("coachId", "fullName")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalReviews: total,
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

// @desc    Get Reviews by Court
// @route   GET /api/reviews/court/:courtId
// @access Public
export const getReviewsByCourt = async (req, res) => {
  try {
    const { courtId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ courtId, isApproved: true })
      .populate("customerId", "fullName avatar")
      .populate("venueId", "name")
      .populate("coachId", "fullName")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ courtId, isApproved: true });

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalReviews: total,
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

// @desc    Get User Reviews
// @route   GET /api/reviews/user
// @access Private
export const getUserReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ customerId: userId })
      .populate("venueId", "name")
      .populate("courtId", "name sportType")
      .populate("coachId", "fullName")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ customerId: userId });

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalReviews: total,
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

// @desc    Update Review
// @route   PUT /api/reviews/:reviewId
// @access Private
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check if user is the author
    if (!review.customerId.equals(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this review",
      });
    }

    // Update review
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        review[key] = updateData[key];
      }
    });

    review.isApproved = false; // Reset approval status after update
    await review.save();

    // Update ratings
    await updateRatings(review.venueId, review.courtId);

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: {
        review,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete Review
// @route   DELETE /api/reviews/:reviewId
// @access Private
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check if user is the author
    if (!review.customerId.equals(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this review",
      });
    }

    await Review.findByIdAndDelete(reviewId);

    // Update ratings
    await updateRatings(review.venueId, review.courtId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Vote Review Helpful
// @route   POST /api/reviews/:reviewId/vote
// @access Private
export const voteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { helpful } = req.body; // true for helpful, false for not helpful

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (helpful) {
      review.helpfulVotes += 1;
    } else {
      review.notHelpfulVotes += 1;
    }

    await review.save();

    res.status(200).json({
      success: true,
      message: `Review marked as ${helpful ? 'helpful' : 'not helpful'}`,
      data: {
        helpfulVotes: review.helpfulVotes,
        notHelpfulVotes: review.notHelpfulVotes,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Respond to Review (Venue Owner)
// @route   POST /api/reviews/:reviewId/respond
// @access Private (Owner)
export const respondToReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Response message is required",
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check if user is venue owner
    const venue = await Venue.findById(review.venueId);
    if (!venue.ownerId.equals(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to respond to this review",
      });
    }

    // Check if already responded
    if (review.venueResponse.message) {
      return res.status(400).json({
        success: false,
        message: "Already responded to this review",
      });
    }

    review.venueResponse = {
      message,
      respondedBy: userId,
      respondedAt: new Date(),
    };

    await review.save();

    res.status(200).json({
      success: true,
      message: "Response added successfully",
      data: {
        venueResponse: review.venueResponse,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Review Statistics
// @route   GET /api/reviews/stats/:venueId
// @access Public
export const getReviewStats = async (req, res) => {
  try {
    const { venueId } = req.params;

    const stats = await Review.aggregate([
      { $match: { venueId: mongoose.Types.ObjectId(venueId), isApproved: true } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$overallRating" },
          ratingDistribution: {
            $push: "$overallRating"
          },
          averageFacilities: { $avg: "$detailRatings.facilities" },
          averageService: { $avg: "$detailRatings.service" },
          averageCleanliness: { $avg: "$detailRatings.cleanliness" },
          averageValue: { $avg: "$detailRatings.value" },
        }
      }
    ]);

    if (stats.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          stats: {
            totalReviews: 0,
            averageRating: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            averageFacilities: 0,
            averageService: 0,
            averageCleanliness: 0,
            averageValue: 0,
          },
        },
      });
    }

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].ratingDistribution.forEach(rating => {
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalReviews: stats[0].totalReviews,
          averageRating: Math.round(stats[0].averageRating * 10) / 10,
          ratingDistribution,
          averageFacilities: Math.round(stats[0].averageFacilities * 10) / 10,
          averageService: Math.round(stats[0].averageService * 10) / 10,
          averageCleanliness: Math.round(stats[0].averageCleanliness * 10) / 10,
          averageValue: Math.round(stats[0].averageValue * 10) / 10,
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

// Helper function to update venue and court ratings
const updateRatings = async (venueId, courtId) => {
  try {
    // Update venue ratings
    const venueReviews = await Review.find({ venueId, isApproved: true });
    if (venueReviews.length > 0) {
      const totalRating = venueReviews.reduce((sum, review) => sum + review.overallRating, 0);
      const averageRating = totalRating / venueReviews.length;

      await Venue.findByIdAndUpdate(venueId, {
        "ratings.average": Math.round(averageRating * 10) / 10,
        "ratings.count": venueReviews.length,
      });
    }

    // Update court ratings
    const courtReviews = await Review.find({ courtId, isApproved: true });
    if (courtReviews.length > 0) {
      const totalRating = courtReviews.reduce((sum, review) => sum + review.overallRating, 0);
      const averageRating = totalRating / courtReviews.length;

      await Court.findByIdAndUpdate(courtId, {
        "ratings.average": Math.round(averageRating * 10) / 10,
        "ratings.count": courtReviews.length,
      });
    }
  } catch (error) {
    console.error("Error updating ratings:", error);
  }
};
