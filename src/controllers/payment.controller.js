import Booking from "../models/booking.js";
import PaymentTransaction from "../models/paymentTransaction.js";

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
