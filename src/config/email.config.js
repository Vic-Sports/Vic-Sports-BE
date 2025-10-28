export const emailConfig = {
  // Google OAuth2 Configuration
  googleMailerClientId: process.env.GOOGLE_MAILER_CLIENT_ID,
  googleMailerClientSecret: process.env.GOOGLE_MAILER_CLIENT_SECRET,
  // Provide the refresh token you obtained from OAuth Playground (or your own OAuth flow)
  // Make sure you selected "Use your own OAuth credentials" in OAuth Playground and used
  // the same client ID + secret configured below when generating the refresh token.
  googleMailerRefreshToken: process.env.GOOGLE_MAILER_REFRESH_TOKEN,

  // Email Addresses
  adminEmailAddress: process.env.ADMIN_EMAIL_ADDRESS || "admin@vicsports.com",
  fromName: process.env.FROM_NAME || "Vic Sports",

  // SMTP Configuration (Fallback)
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  },

  // Email Settings
  maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || "3"),
  retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || "1000"),
  timeout: parseInt(process.env.EMAIL_TIMEOUT || "5000"),

  // Email Templates
  defaultLanguage: process.env.EMAIL_DEFAULT_LANGUAGE || "en",
  defaultTimezone: process.env.EMAIL_DEFAULT_TIMEZONE || "UTC",
};

// Determine whether OAuth2 should be used (all three google vars present)
emailConfig.useOAuth = Boolean(
  process.env.GOOGLE_MAILER_CLIENT_ID &&
    process.env.GOOGLE_MAILER_CLIENT_SECRET &&
    process.env.GOOGLE_MAILER_REFRESH_TOKEN
);

// Ensure at least an admin email address is set
if (!emailConfig.adminEmailAddress) {
  throw new Error(
    "Missing required admin email address configuration (ADMIN_EMAIL_ADDRESS)"
  );
}

// If neither OAuth nor SMTP credentials are available, warn (but do not throw)
if (
  !emailConfig.useOAuth &&
  !(
    emailConfig.smtp &&
    emailConfig.smtp.auth &&
    emailConfig.smtp.auth.user &&
    emailConfig.smtp.auth.pass
  )
) {
  // No transport credentials present; email sending will fail until configured.
  // We intentionally do not throw here so the app can run in environments without email configured.
  // Consumers should set either Google OAuth credentials or SMTP credentials.
  // If you plan to use OAuth Playground to obtain a refresh token, enable "Use your own OAuth credentials"
  // in the playground and make sure the CLIENT_ID and CLIENT_SECRET you used there match
  // GOOGLE_MAILER_CLIENT_ID and GOOGLE_MAILER_CLIENT_SECRET here. Otherwise Google will return invalid_grant.
}
