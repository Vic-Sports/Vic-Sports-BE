import express from "express";
import { oAuth2Client, getGoogleAuthUrl } from "../config/googleAuth.js";
import { protect } from "../middlewares/auth.middleware.js";
import User from "../models/user.js";

const router = express.Router();

/**
 * Redirects user to Google for consent and to obtain a refresh token.
 */
router.get("/google", (req, res) => {
  const url = getGoogleAuthUrl();
  res.redirect(url);
});

/**
 * OAuth2 callback endpoint to exchange code for tokens.
 */
router.get("/google/callback", protect, async (req, res, next) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send("Code not found in query parameters");
    }
    const { tokens } = await oAuth2Client.getToken(code);
    if (tokens.refresh_token) {
      // Save user's refresh token securely
      await User.findByIdAndUpdate(req.user._id, {
        googleRefreshToken: tokens.refresh_token,
      });
    }
    return res.send(
      "Authentication successful! You can close this window now."
    );
  } catch (err) {
    next(err);
  }
});

export default router;
