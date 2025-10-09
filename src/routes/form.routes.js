import express from "express";
import { createDynamicBookingForm } from "../services/googleForm.service.js";
import { protect } from "../middlewares/auth.middleware.js";
import Venue from "../models/venue.js";
import Court from "../models/court.js";

const router = express.Router();

/**
 * POST /generate
 * Body: { title: string, items: Array<{ title: string, type?: string, required?: boolean }> }
 * Creates a new Google Form based on provided configuration.
 */
router.post("/generate", protect, async (req, res, next) => {
  // Expecting full objects and template from frontend
  const { template, venue, court, filters = {} } = req.body;
  // Validate required parts
  if (!template?.title || !Array.isArray(template.items)) {
    return res
      .status(400)
      .json({ success: false, message: "Missing or invalid template" });
  }
  if (!venue?.name || !court?.name) {
    return res
      .status(400)
      .json({ success: false, message: "Missing venue or court data" });
  }
  try {
    const ownerId = req.user._id;
    // Load full venue and court records to include pricing and availability
    const venueData = await Venue.findById(venue._id);
    const courtData = await Court.findById(court._id);
    if (!venueData || !courtData) {
      return res
        .status(404)
        .json({ success: false, message: "Venue or Court not found" });
    }
    // Extract filters first to use date in title
    const { date, startTime, endTime } = filters;
    // Set form title including date
    const title = `Đăng ký đặt sân ${courtData.name} tại ${venueData.name}`;
    // Initialize items from template only
    let items = [...template.items];
    // Always fetch available slots for Time Slot
    const available = await import("../utils/slotUtils.js").then((m) =>
      m.getAvailableSlots(venueData, courtData, date, startTime, endTime)
    );
    if (available.length > 0) {
      const options = available.map((s) => s.label);
      items.push({
        title: "Time Slot",
        type: "multipleChoice",
        required: true,
        options,
      });
    } else {
      // No slots available, fallback to text input
      items.push({ title: "Time Slot", type: "text", required: true });
    }
    // Build form description and get venue image
    const description = `Chào mừng đến với ${venueData.name}!\n\nBạn đang thực hiện đăng ký đặt sân ${courtData.name} cho ngày ${date}. Vui lòng chọn khung giờ phù hợp bên dưới.`;
    const imageUrl =
      venueData.images && venueData.images.length > 0
        ? venueData.images[0]
        : null;
    // Create the Google Form with title, description and venue image
    const form = await createDynamicBookingForm(ownerId, {
      title,
      description,
      imageUrl,
      items,
    });
    // Provide form ID and edit URL to frontend
    const formId = form.formId;
    const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;
    res.json({ success: true, data: { formId, editUrl } });
  } catch (err) {
    next(err);
  }
});

export default router;
