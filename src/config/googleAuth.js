import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

const clientId = process.env.GOOGLE_CLIENT_ID_BOOKING;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET_BOOKING;
const redirectUri = process.env.GOOGLE_REDIRECT_URI_BOOKING;
// Note: remove global refresh token, tokens are per-user stored in DB

// Debug: print loaded OAuth credentials (mask secrets)
console.log("[googleAuth] CLIENT_ID_BOOKING loaded:", Boolean(clientId));
console.log(
  "[googleAuth] CLIENT_SECRET_BOOKING loaded:",
  Boolean(clientSecret)
);
console.log("[googleAuth] REDIRECT_URI_BOOKING:", redirectUri);

// Validate credentials only when initiating auth URL

const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

const scopes = [
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/drive",
];

/**
 * Generates a URL for user consent to obtain a refresh token and access token.
 */
function getGoogleAuthUrl(state) {
  // Detailed debug of OAuth config
  console.log("[googleAuth] getGoogleAuthUrl ->", {
    clientId: Boolean(clientId),
    clientSecret: Boolean(clientSecret),
    redirectUri,
  });
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth credentials. Ensure GOOGLE_CLIENT_ID_BOOKING, GOOGLE_CLIENT_SECRET_BOOKING, and GOOGLE_REDIRECT_URI_BOOKING are set."
    );
  }
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state: state || undefined,
  });
}

/**
 * Returns an authenticated OAuth2 client using the stored refresh token.
 * Throws an error if the refresh token is missing.
 */
/**
 * Returns an authenticated OAuth2 client for the given user by loading their refresh token from DB.
 * @param {string} userId - Mongoose ObjectId of the User
 * @returns {Promise<OAuth2Client>} Authenticated OAuth2 client
 * @throws {Error} If user or token not found
 */
import User from "../models/user.js";
async function getAuthenticatedClientForUser(userId) {
  const user = await User.findById(userId).select("+googleRefreshToken");
  if (!user || !user.googleRefreshToken) {
    throw new Error("Google OAuth refresh token not found for user: " + userId);
  }
  oAuth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
  return oAuth2Client;
}

// Export core functions and config values for debugging
export { oAuth2Client, getGoogleAuthUrl, getAuthenticatedClientForUser };
export const GOOGLE_CLIENT_ID_BOOKING = clientId;
export const GOOGLE_CLIENT_SECRET_BOOKING = clientSecret;
export const GOOGLE_REDIRECT_URI_BOOKING = redirectUri;
