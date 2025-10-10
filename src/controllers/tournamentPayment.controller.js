import Tournament from "../models/tournament.js";
import TournamentRegistration from "../models/tournamentRegistration.js";
import payosService from "../services/payos.service.js";
import { asyncHandler } from "../middlewares/async.middleware.js";

// @desc    Create PayOS payment for tournament registration
// @route   POST /api/v1/tournaments/:tournamentId/payment/create
// @access  Private
export const createTournamentPayment = asyncHandler(async (req, res) => {
  try {
    console.log("=== CREATE TOURNAMENT PAYMENT ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const { tournamentId } = req.params;
    const {
      registrationId,
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

    if (!registrationId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: registrationId, amount",
      });
    }

    // Find tournament
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: "Tournament not found",
      });
    }

    // Find registration
    const registration = await TournamentRegistration.findById(registrationId)
      .populate("participantId", "fullName email phoneNumber")
      .populate("tournamentId", "name venueId");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // Check if registration belongs to tournament
    if (registration.tournamentId._id.toString() !== tournamentId) {
      return res.status(400).json({
        success: false,
        message: "Registration does not belong to this tournament",
      });
    }

    // Idempotent behavior: if registration already has a PayOS order, return existing payment info
    if (registration.payosOrderCode) {
      try {
        const existing = await payosService.getPaymentInfo(registration.payosOrderCode);
        if (existing.success) {
          return res.status(200).json({
            success: true,
            data: {
              registration: {
                id: registration._id,
                payosOrderCode: registration.payosOrderCode,
              },
              payment: {
                orderCode: existing.data?.orderCode,
                checkoutUrl: existing.data?.checkoutUrl || existing.data?.data?.checkoutUrl,
                qrCode: existing.data?.qrCode || existing.data?.data?.qrCode,
                paymentLinkId: existing.data?.paymentLinkId || existing.data?.data?.paymentLinkId,
                amount: existing.data?.amount,
                currency: existing.data?.currency || existing.data?.data?.currency || "VND",
                status: existing.data?.status || existing.data?.data?.status || "PENDING",
                paymentUrl: existing.data?.checkoutUrl || existing.data?.data?.checkoutUrl || null,
                paymentRef: existing.data?.paymentLinkId || existing.data?.data?.paymentLinkId || String(registration.payosOrderCode),
              },
            },
            message: "Existing PayOS payment link returned",
          });
        }
      } catch (e) {
        // fall through to creation if fetching existing fails
      }
    }

    // Create unique order code (PayOS requires unique)
    const orderCode = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);

    // PayOS limits description to <= 25 characters
    const fallbackDesc = `Đăng ký ${tournament.name}`;
    const rawDescription = description || fallbackDesc;
    const safeDescription = String(rawDescription).slice(0, 25);

    const paymentData = {
      orderCode,
      amount: Number(amount),
      description: safeDescription,
      items: items || [
        {
          name: `Đăng ký ${tournament.name}`,
          quantity: 1,
          price: Number(amount),
        },
      ],
      buyerName: buyerName || registration.participantId.fullName,
      buyerEmail: buyerEmail || registration.participantId.email,
      buyerPhone: buyerPhone || registration.participantId.phoneNumber,
      // Use frontend URLs so PayOS redirects directly to frontend
      returnUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/return`,
      cancelUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/cancel`,
      expiredAt,
    };

    console.log("Creating PayOS payment with data:", paymentData);

    // Call PayOS using SDK
    const result = await payosService.createPaymentLinkSDK(paymentData);

    if (result.success) {
      // Update registration with PayOS order code
      registration.payosOrderCode = orderCode;
      registration.paymentMethod = "payos";
      await registration.save();

      console.log("PayOS payment created successfully");

      return res.status(201).json({
        success: true,
        data: {
          registration: {
            id: registration._id,
            payosOrderCode: orderCode,
          },
          payment: {
            orderCode,
            checkoutUrl: result.data?.checkoutUrl || result.data?.data?.checkoutUrl,
            qrCode: result.data?.qrCode || result.data?.data?.qrCode,
            paymentLinkId: result.data?.paymentLinkId || result.data?.data?.paymentLinkId,
            amount: Number(amount),
            currency: result.data?.currency || result.data?.data?.currency || "VND",
            status: result.data?.status || result.data?.data?.status || "PENDING",
            paymentUrl: result.data?.checkoutUrl || result.data?.data?.checkoutUrl || null,
            paymentRef: result.data?.paymentLinkId || result.data?.data?.paymentLinkId || String(orderCode),
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
    console.error("Create tournament payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// @desc    Verify PayOS payment for tournament registration
// @route   POST /api/v1/tournaments/:tournamentId/payment/verify
// @access  Private
export const verifyTournamentPayment = asyncHandler(async (req, res) => {
  try {
    console.log("=== TOURNAMENT PAYMENT VERIFICATION ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const { orderCode } = req.body;

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        message: "Order code is required",
      });
    }

    // Find registration by payosOrderCode
    const registration = await TournamentRegistration.findOne({ payosOrderCode: orderCode })
      .populate("tournamentId", "name venueId")
      .populate("participantId", "fullName email phoneNumber");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    console.log("Found registration:", registration._id);

    // Get payment info from PayOS
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

      // Check payment status according to new PayOS docs
      if (paymentInfo.status === "PAID") {
        // Update registration as successful
        registration.paymentStatus = "paid";
        registration.status = "approved";
        registration.payosTransactionId = paymentInfo.transactions?.[0]?.reference || paymentInfo.reference;
        registration.paidAt = new Date();

        await registration.save();

        console.log("Payment verified successfully");

        return res.status(200).json({
          success: true,
          data: {
            registration: {
              id: registration._id,
              status: registration.status,
              paymentStatus: registration.paymentStatus,
              payosOrderCode: registration.payosOrderCode,
              payosTransactionId: registration.payosTransactionId,
              tournament: registration.tournamentId,
              participant: registration.participantId,
              paidAt: registration.paidAt,
            },
            paymentInfo: {
              orderCode: paymentInfo.orderCode,
              amount: paymentInfo.amount,
              currency: paymentInfo.currency,
              status: paymentInfo.status,
              paidAt: paymentInfo.paidAt,
            },
          },
          message: "Payment verified successfully",
        });
      } else if (paymentInfo.status === "CANCELLED") {
        // Update registration as cancelled
        registration.paymentStatus = "cancelled";
        registration.status = "withdrawn";
        registration.withdrawnAt = new Date();
        registration.withdrawalReason = "Payment cancelled by user or expired";
        await registration.save();

        console.log(`Registration ${registration._id} marked as withdrawn due to payment cancellation`);

        return res.status(200).json({
          success: false,
          status: "CANCELLED",
          message: "Payment failed or cancelled",
        });
      } else {
        // Payment still pending/unknown
        const flow = process.env.PAYOS_FLOW || process.env.NODE_ENV || "poll";
        const pendingPayload = {
          success: false,
          status: paymentInfo.status || "UNKNOWN",
          message: "Payment is pending",
        };

        if (String(flow).toLowerCase() === "poll" || String(flow).toLowerCase() === "development") {
          // Dev/local: return 202 so FE understands it's processing and continues polling
          return res.status(202).json(pendingPayload);
        }
        // Prod/webhook: still return 200 but FE should rely on webhook primarily
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
    console.error("Tournament payment verification error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// @desc    Get tournament payment status
// @route   GET /api/v1/tournaments/:tournamentId/payment/status/:orderCode
// @access  Private
export const getTournamentPaymentStatus = asyncHandler(async (req, res) => {
  try {
    const { orderCode } = req.params;

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        message: "Order code is required",
      });
    }

    // Find registration
    const registration = await TournamentRegistration.findOne({ payosOrderCode: orderCode })
      .populate("tournamentId", "name")
      .populate("participantId", "fullName");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // Get info from PayOS
    try {
      const paymentResult = await payosService.getPaymentInfo(orderCode);

      if (!paymentResult || !paymentResult.success) {
        throw new Error(paymentResult?.error || "Failed to fetch PayOS info");
      }

      const paymentInfo = paymentResult.data || paymentResult;
      const respOrderCode = paymentInfo.orderCode || paymentInfo.data?.orderCode || String(orderCode);
      const respStatus = String(paymentInfo.status || paymentInfo.data?.status || "").toUpperCase();

      return res.status(200).json({
        success: true,
        data: {
          orderCode: respOrderCode,
          status: respStatus,
        },
      });
    } catch (payosError) {
      console.error("PayOS get payment info error:", payosError);

      // Return registration info if can't get from PayOS
      res.status(200).json({
        success: true,
        data: {
          registration: {
            id: registration._id,
            status: registration.status,
            paymentStatus: registration.paymentStatus,
            tournament: registration.tournamentId,
            participant: registration.participantId,
            payosOrderCode: registration.payosOrderCode,
            payosTransactionId: registration.payosTransactionId,
            paidAt: registration.paidAt,
          },
        },
        message: "Registration info only (PayOS API error)",
      });
    }
  } catch (error) {
    console.error("Get tournament payment status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// @desc    Cancel PayOS payment for tournament registration
// @route   POST /api/v1/tournaments/:tournamentId/payment/cancel
// @access  Private
export const cancelTournamentPayment = asyncHandler(async (req, res) => {
  try {
    const { orderCode } = req.params;
    const { reason } = req.body;

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        message: "Order code is required",
      });
    }

    console.log(`Cancelling tournament payment: ${orderCode}`);

    // Find registration
    const registration = await TournamentRegistration.findOne({ payosOrderCode: orderCode });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // Cancel payment link with PayOS
    const result = await payosService.cancelPaymentLink(orderCode);

    if (result.success) {
      // Update registration status
      registration.paymentStatus = "cancelled";
      registration.status = "withdrawn";
      registration.withdrawalReason = reason || "Payment cancelled by user";
      registration.withdrawnAt = new Date();
      await registration.save();

      console.log(`Tournament payment cancelled successfully for registration ${registration._id}`);

      return res.status(200).json({
        success: true,
        data: {
          registration: {
            id: registration._id,
            status: registration.status,
            paymentStatus: registration.paymentStatus,
          },
        },
        message: "Tournament payment cancelled successfully",
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
    console.error("Cancel tournament payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// @desc    Handle PayOS return for tournament payment (success)
// @route   GET /api/v1/tournaments/payment/return
// @access  Public
export const tournamentPaymentReturn = asyncHandler(async (req, res) => {
  try {
    const { orderCode, code, id, cancel, status } = req.query;

    console.log("=== TOURNAMENT PAYMENT RETURN ===");
    console.log("Query params:", req.query);

    if (!orderCode) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/error?message=Missing orderCode`
      );
    }

    // Find registration by orderCode
    const registration = await TournamentRegistration.findOne({ payosOrderCode: orderCode })
      .populate("tournamentId", "name")
      .populate("participantId", "fullName");

    if (!registration) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/error?message=Registration not found`
      );
    }

    // Check if this is a cancel request (cancel=true OR status=CANCELLED)
    if (cancel === "true" || status === "CANCELLED") {
      // Handle cancellation
      registration.paymentStatus = "cancelled";
      registration.status = "withdrawn";
      registration.withdrawnAt = new Date();
      registration.withdrawalReason = "Payment cancelled by user";
      await registration.save();

      console.log(`Payment cancelled for registration ${registration._id}`);

      // Redirect to frontend with cancel params
      const redirectUrl =
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/return?` +
        `code=${code || "00"}&` +
        `id=${id || ""}&` +
        `cancel=true&` +
        `status=CANCELLED&` +
        `orderCode=${orderCode}&` +
        `registrationId=${registration._id}`;

      return res.redirect(redirectUrl);
    }

    try {
      // Verify payment with PayOS
      const paymentResult = await payosService.getPaymentInfo(orderCode);

      if (paymentResult.success && paymentResult.data) {
        const paymentStatus = paymentResult.data.status;

        if (paymentStatus === "PAID") {
          // Payment successful
          registration.paymentStatus = "paid";
          registration.status = "approved";
          registration.paidAt = new Date();
          registration.payosTransactionId = paymentResult.data.transactions?.[0]?.reference;
          await registration.save();

          console.log(`Payment successful for registration ${registration._id}`);

          // Redirect to success page with registration info
          const redirectUrl =
            `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/success?` +
            `registrationId=${registration._id}&` +
            `orderCode=${orderCode}&` +
            `status=paid&` +
            `amount=${paymentResult.data.amount || registration.tournamentId.registrationFee}&` +
            `tournamentName=${encodeURIComponent(registration.tournamentId.name)}`;

          return res.redirect(redirectUrl);
        } else {
          // Payment failed or cancelled
          registration.paymentStatus = paymentStatus === "CANCELLED" ? "cancelled" : "failed";
          registration.status = "withdrawn";
          registration.withdrawnAt = new Date();
          registration.withdrawalReason = `Payment ${paymentStatus.toLowerCase()}`;
          await registration.save();

          console.log(`Payment ${paymentStatus} for registration ${registration._id}`);

          // Redirect to cancel/failed page
          const redirectUrl =
            `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/cancel?` +
            `registrationId=${registration._id}&` +
            `orderCode=${orderCode}&` +
            `status=${paymentStatus.toLowerCase()}&` +
            `reason=${encodeURIComponent("Payment " + paymentStatus.toLowerCase())}`;

          return res.redirect(redirectUrl);
        }
      } else {
        throw new Error(paymentResult.error || "Failed to verify payment");
      }
    } catch (payosError) {
      console.error("PayOS verification error in return:", payosError);

      // Fallback: redirect with error
      const redirectUrl =
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/error?` +
        `registrationId=${registration._id}&` +
        `orderCode=${orderCode}&` +
        `message=${encodeURIComponent("Payment verification failed")}`;

      return res.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("Tournament payment return error:", error);

    const redirectUrl =
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/error?` +
      `message=${encodeURIComponent("Internal server error")}`;

    return res.redirect(redirectUrl);
  }
});

// @desc    Handle PayOS cancel for tournament payment
// @route   GET /api/v1/tournaments/payment/cancel
// @access  Public
export const tournamentPaymentCancel = asyncHandler(async (req, res) => {
  try {
    const { orderCode, code, id, cancel, status } = req.query;

    console.log("=== TOURNAMENT PAYMENT CANCEL ===");
    console.log("Query params:", req.query);

    if (!orderCode) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/cancel?message=Payment cancelled`
      );
    }

    // Find registration by orderCode
    const registration = await TournamentRegistration.findOne({ payosOrderCode: orderCode })
      .populate("tournamentId", "name")
      .populate("participantId", "fullName");

    if (registration) {
      // Update registration status
      registration.paymentStatus = "cancelled";
      registration.status = "withdrawn";
      registration.withdrawnAt = new Date();
      registration.withdrawalReason = "Payment cancelled by user";
      await registration.save();

      console.log(`Payment cancelled for registration ${registration._id}`);

      // Redirect to cancel page with registration info
      const redirectUrl =
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/cancel?` +
        `registrationId=${registration._id}&` +
        `orderCode=${orderCode}&` +
        `status=cancelled&` +
        `reason=${encodeURIComponent("Payment cancelled by user")}`;

      return res.redirect(redirectUrl);
    } else {
      console.log(`Registration not found for cancelled orderCode: ${orderCode}`);

      // Redirect to general cancel page
      const redirectUrl =
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/cancel?` +
        `orderCode=${orderCode}&` +
        `status=cancelled&` +
        `message=${encodeURIComponent("Payment cancelled")}`;

      return res.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("Tournament payment cancel error:", error);

    const redirectUrl =
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/tournament/payment/cancel?` +
      `message=${encodeURIComponent("Payment cancelled")}`;

    return res.redirect(redirectUrl);
  }
});
