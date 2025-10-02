import { cloudinary } from "../config/cloudinary.js";
import User from "../models/user.js";
import Venue from "../models/venue.js";
import Court from "../models/court.js";

/**
 * @desc    Upload file to Cloudinary
 * @route   POST /api/v1/file/upload
 * @access  Private
 */
export const uploadFile = async (req, res) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Get upload type and additional path info from headers
    const uploadType = req.headers["upload-type"] || "general";
    const venueId = req.headers["venue-id"];
    const courtId = req.headers["court-id"];

    // Build folder path based on upload type
    let folderPath;

    if (uploadType === "venue-image" && venueId) {
      // Upload venue images: vic-sports/venues/{venueId}/venue-images/
      folderPath = `vic-sports/venues/${venueId}/venue-images`;
    } else if (uploadType === "court-image" && venueId && courtId) {
      // Upload court images: vic-sports/venues/{venueId}/courts/{courtId}/
      folderPath = `vic-sports/venues/${venueId}/courts/${courtId}`;
    } else if (uploadType === "avatar") {
      // User avatars
      folderPath = `vic-sports/users/avatars`;
    } else {
      // General files
      folderPath = `vic-sports/${uploadType}`;
    }

    // The file is already uploaded to cloudinary via multer middleware
    // Just need to move it to the correct folder and return the URL
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: folderPath,
      resource_type: "auto", // Automatically detect file type
      transformation: [
        { width: 1000, height: 1000, crop: "limit" }, // Limit size
        { quality: "auto" }, // Auto optimize quality
      ],
    });

    // Auto-update database based on upload type
    let updateResult = null;

    if (uploadType === "avatar") {
      // Update user avatar in database
      const userId = req.user.id;
      updateResult = await User.findByIdAndUpdate(
        userId,
        { avatar: result.secure_url },
        { new: true, select: "avatar fullName email" }
      );
    } else if (
      (uploadType === "venue-image" || uploadType === "venue") &&
      venueId
    ) {
      // Add image to venue images array
      updateResult = await Venue.findByIdAndUpdate(
        venueId,
        { $addToSet: { images: result.secure_url } },
        { new: true, select: "name images" }
      );
    } else if (
      (uploadType === "court-image" || uploadType === "court") &&
      venueId &&
      courtId
    ) {
      // Try update in Court collection first
      updateResult = await Court.findByIdAndUpdate(
        courtId,
        { $addToSet: { images: result.secure_url } },
        { new: true, select: "name images" }
      );

      if (!updateResult) {
        // If not found in Court collection, try updating as subdocument inside Venue.courts
        const venueUpdate = await Venue.findOneAndUpdate(
          { _id: venueId, "courts._id": courtId },
          { $addToSet: { "courts.$.images": result.secure_url } },
          { new: true, select: "name courts" }
        );

        if (venueUpdate) {
          // Extract updated court subdocument
          const updatedCourt = (venueUpdate.courts || []).find(
            (c) => String(c._id) === String(courtId)
          );
          updateResult = updatedCourt || {
            venue: venueUpdate.name,
            courtUpdated: true,
          };
        }
      }
    }

    // Return success response matching FE expected format
    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        fileUploaded: result.secure_url,
        publicId: result.public_id,
        folderPath: folderPath,
        uploadType: uploadType,
        venueId: venueId || null,
        courtId: courtId || null,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        // Include database update result
        dbUpdated: updateResult ? true : false,
        updatedRecord: updateResult || null,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload file",
      error: error.message,
    });
  }
};
