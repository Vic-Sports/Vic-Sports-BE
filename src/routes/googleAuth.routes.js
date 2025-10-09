import express from "express";
import jwt from "jsonwebtoken";
import { oAuth2Client, getGoogleAuthUrl } from "../config/googleAuth.js";
import { protect } from "../middlewares/auth.middleware.js";
import User from "../models/user.js";

const router = express.Router();

// Helper: return Google OAuth URL as JSON (frontend should call with credentials:true)
router.get("/url", async (req, res) => {
  try {
    // reuse logic from root handler to build outgoingState
    let outgoingState = req.query.state;
    try {
      if (!outgoingState) {
        const tokenFromCookie = req.cookies?.token || null;
        const headerAuth = req.headers?.authorization;
        const token = tokenFromCookie || (headerAuth ? headerAuth.split(" ")[1] : null);
        let userId = null;
        if (token) {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.userId) userId = decoded.userId;
          } catch (ve) {
            const decoded = jwt.decode(token);
            if (decoded && decoded.userId) userId = decoded.userId;
          }
        }

        if (userId) {
          const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.JWT_SECRET;
          outgoingState = jwt.sign({ userId }, stateSecret, { expiresIn: "10m" });
        }
      }
    } catch (e) {
      console.warn('[googleAuth.routes] failed to build state token (url)', e?.message);
    }

    const url = getGoogleAuthUrl(outgoingState);
    return res.status(200).json({ url });
  } catch (err) {
    console.error('[googleAuth.routes] /url error', err);
    return res.status(500).json({ message: 'Failed to build Google auth url' });
  }
});

// Redirects to Google's OAuth consent screen
router.get("/", async (req, res) => {
  // Debug: print out the loaded environment variables
  console.log(
    "[googleAuth.routes] process.env.GOOGLE_CLIENT_ID_BOOKING =",
    process.env.GOOGLE_CLIENT_ID_BOOKING
  );
  console.log(
    "[googleAuth.routes] process.env.GOOGLE_CLIENT_SECRET_BOOKING =",
    process.env.GOOGLE_CLIENT_SECRET_BOOKING
  );
  console.log(
    "[googleAuth.routes] process.env.GOOGLE_REDIRECT_URI_BOOKING =",
    process.env.GOOGLE_REDIRECT_URI_BOOKING
  );
  // Validate required env vars upfront
  const missing = [];
  if (!process.env.GOOGLE_CLIENT_ID_BOOKING)
    missing.push("GOOGLE_CLIENT_ID_BOOKING");
  if (!process.env.GOOGLE_CLIENT_SECRET_BOOKING)
    missing.push("GOOGLE_CLIENT_SECRET_BOOKING");
  if (!process.env.GOOGLE_REDIRECT_URI_BOOKING)
    missing.push("GOOGLE_REDIRECT_URI_BOOKING");
  if (missing.length) {
    console.error("[googleAuth.routes] Missing env vars:", missing);
    return res
      .status(500)
      .send(`Missing environment variables: ${missing.join(", ")}`);
  }
  // All present, try to build a signed state token so callback can recover userId
  // Prefer an explicit state query param from the frontend, otherwise try to extract userId from cookie/authorization header.
  let outgoingState = req.query.state;
  try {
    if (!outgoingState) {
      // try to get userId from cookie or Authorization header
      const tokenFromCookie = req.cookies?.token || null;
      const headerAuth = req.headers?.authorization;
      const token = tokenFromCookie || (headerAuth ? headerAuth.split(" ")[1] : null);
      let userId = null;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded && decoded.userId) userId = decoded.userId;
        } catch (ve) {
          // fallback to decode without verify
          const decoded = jwt.decode(token);
          if (decoded && decoded.userId) userId = decoded.userId;
        }
      }

      if (userId) {
        const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.JWT_SECRET;
        // short-lived state token
        outgoingState = jwt.sign({ userId }, stateSecret, { expiresIn: "10m" });
      }
    }
  } catch (e) {
    console.warn('[googleAuth.routes] failed to build state token', e?.message);
  }

  const url = getGoogleAuthUrl(outgoingState);
  console.log("[googleAuth.routes] Redirecting to Google URL");
  res.redirect(url);
});

// OAuth2 callback endpoint: save refresh token to user
router.get("/callback", async (req, res, next) => {
  try {
  const code = req.query.code;
  const state = req.query.state; // opaque state token (may contain signed userId)
    if (!code) {
      return res.status(400).send("Missing code in query parameters");
    }
    const { tokens } = await oAuth2Client.getToken(code);

    // Debug: log tokens (avoid logging in production or mask sensitive fields)
    console.log('[googleAuth.routes] tokens received:', {
      access_token: Boolean(tokens.access_token),
      refresh_token: Boolean(tokens.refresh_token),
      expiry_date: tokens.expiry_date,
    });

  // Prefer authenticated user (cookie) if available; fall back to state.
    let userId = null;
    try {
      if (req.user && req.user._id) userId = req.user._id;
    } catch (_) {}

    // If no req.user, attempt to decode JWT from cookie or Authorization header

    if (!userId) {
      try {
        const tokenFromCookie = req.cookies?.token || req.headers?.cookie?.split('token=')[1];
        const headerAuth = req.headers?.authorization;
        const token = tokenFromCookie || (headerAuth ? headerAuth.split(' ')[1] : null);
        if (token) {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.userId) userId = decoded.userId;
          } catch (ve) {
            // token may be expired; try decode without verify to extract userId
            const decoded = jwt.decode(token);
            if (decoded && decoded.userId) userId = decoded.userId;
          }
        }
      } catch (e) {
        console.warn('[googleAuth.routes] could not decode JWT from cookie/header', e?.message);
      }
    }

  // If state looks like a signed JWT, try to verify and extract userId
  if (!userId && state) {
    try {
      const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.JWT_SECRET;
      const decodedState = jwt.verify(state, stateSecret);
      if (decodedState && decodedState.userId) userId = decodedState.userId;
    } catch (ve) {
      // not a signed state token, maybe frontend passed userId directly
      if (/^[0-9a-fA-F]{24}$/.test(state)) userId = state;
    }
  }

    if (tokens.refresh_token) {
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          googleRefreshToken: tokens.refresh_token,
        });
        res.send("Authentication successful! You can close this window now.");
        return;
      }

  // If no userId available, log more context for debugging
  console.warn(
        "[googleAuth.routes] No user id available to persist googleRefreshToken. State:",
        state,
        'cookiesPresent:', Boolean(req.cookies && req.cookies.token)
      );
    } else {
      console.warn('[googleAuth.routes] No refresh_token present in tokens (may be a non-first consent)');
    }

    res.send("Authentication successful! You can close this window now.");
  } catch (err) {
    console.error("[googleAuth.routes] callback error", err);
    next(err);
  }
});

export default router;
