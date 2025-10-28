import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import { emailConfig } from "../config/email.config.js";
import { emailTemplates } from "../templates/email.templates.js";
import logger from "./logger.js";

// We'll initialize OAuth2Client lazily if OAuth is enabled
let oauth2Client = null;

export const sendEmail = async (options) => {
  try {
    let transporter;

    if (emailConfig.useOAuth) {
      try {
        // Lazy init oauth2Client
        oauth2Client =
          oauth2Client ||
          new OAuth2Client(
            emailConfig.googleMailerClientId,
            emailConfig.googleMailerClientSecret
          );
        oauth2Client.setCredentials({
          refresh_token: emailConfig.googleMailerRefreshToken,
        });

        // Get access token. Different google-auth-library versions return either
        // a string or an object like { token, res }. Normalize both cases.
        const accessTokenResult = await oauth2Client.getAccessToken();
        let accessToken;
        let oauthResponse = null;
        if (!accessTokenResult) {
          accessToken = null;
        } else if (typeof accessTokenResult === "string") {
          accessToken = accessTokenResult;
        } else if (accessTokenResult.token) {
          accessToken = accessTokenResult.token;
          oauthResponse = accessTokenResult.res?.data || null;
        } else {
          // Some versions return an object-like response
          accessToken = accessTokenResult?.access_token || null;
          oauthResponse = accessTokenResult?.res?.data || null;
        }

        // Log access token retrieval (mask token for safety)
        if (accessToken && typeof accessToken === "string") {
          const masked =
            accessToken.slice(0, 8) + "..." + accessToken.slice(-8);
          logger.info("Obtained OAuth access token", { accessToken: masked });
        } else {
          logger.warn("No access token returned by OAuth client", {
            response: oauthResponse,
          });
        }

        // Only create OAuth2 transporter when we actually have an access token.
        // If no access token is returned, treat it as an OAuth failure so we fall
        // back to SMTP (if configured). This prevents Nodemailer from attempting
        // PLAIN auth with an incomplete auth object which yields "Missing
        // credentials for \"PLAIN\"".
        if (accessToken && typeof accessToken === "string") {
          transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              type: "OAuth2",
              user: emailConfig.adminEmailAddress,
              clientId: emailConfig.googleMailerClientId,
              clientSecret: emailConfig.googleMailerClientSecret,
              refreshToken: emailConfig.googleMailerRefreshToken,
              accessToken,
            },
          });
        } else {
          // No access token -> force an oauthErr path so we fallback to SMTP (or error clearly)
          throw new Error(
            "No OAuth access token available; will attempt SMTP fallback"
          );
        }
      } catch (oauthErr) {
        // Provide specific guidance when Google returns invalid_grant
        const oauthData =
          oauthErr?.response?.data || oauthErr?.toJSON?.() || null;
        if (oauthData && oauthData.error === "invalid_grant") {
          logger.error(
            "OAuth token refresh failed with invalid_grant. The refresh token may be invalid, revoked, or was issued to a different client ID/secret."
          );
          logger.error("OAuth diagnostic details:", { detail: oauthData });
          logger.error(
            "If you used OAuth Playground, be sure to enable 'Use your own OAuth credentials' and use the SAME client ID and client secret in your environment. Then re-generate a refresh token."
          );
        } else {
          logger.error("OAuth2 failed, falling back to SMTP", {
            error: oauthErr.message,
            detail: oauthData,
          });
        }

        // Fallback to SMTP transporter. Validate credentials first so we can
        // provide an explicit error instead of Nodemailer's PLAIN credentials error.
        const smtpAuth = emailConfig.smtp?.auth || null;
        if (!smtpAuth || !smtpAuth.user || !smtpAuth.pass) {
          const msg =
            "SMTP credentials missing. Set SMTP_USER and SMTP_PASSWORD (or configure OAuth correctly).";
          logger.error(msg, { smtpAuthPresent: Boolean(smtpAuth) });
          // Re-throw an Error with a helpful message so callers can see it
          throw new Error(msg);
        }

        transporter = nodemailer.createTransport({
          host: emailConfig.smtp.host,
          port: parseInt(emailConfig.smtp.port, 10) || 587,
          secure: emailConfig.smtp.secure || false,
          auth: smtpAuth,
          tls: { rejectUnauthorized: false },
        });
      }
    } else {
      // Use SMTP transport when OAuth not configured. Validate credentials first
      const smtpAuth = emailConfig.smtp?.auth || null;
      if (!smtpAuth || !smtpAuth.user || !smtpAuth.pass) {
        const msg =
          "SMTP credentials missing. Set SMTP_USER and SMTP_PASSWORD (or configure OAuth correctly).";
        logger.error(msg, { smtpAuthPresent: Boolean(smtpAuth) });
        throw new Error(msg);
      }

      transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: parseInt(emailConfig.smtp.port, 10) || 587,
        secure: emailConfig.smtp.secure || false,
        auth: smtpAuth,
        tls: { rejectUnauthorized: false },
      });
    }

    // Define email options
    const message = {
      from: `${emailConfig.fromName} <${emailConfig.adminEmailAddress}>`,
      to: options.email,
      subject: options.subject,
      html: options.message,
    };

    // Send email
    const info = await transporter.sendMail(message);
    logger.info("Email sent successfully", {
      messageId: info.messageId,
      envelope: info.envelope,
    });
  } catch (error) {
    // Try to extract more info from Google's response
    const googleResp =
      error.response?.data || (error.toJSON && error.toJSON()) || null;
    logger.error("Error sending email:", {
      error: error.message,
      stack: error.stack,
      googleResponse: googleResp,
    });
    throw error;
  }
};

export const sendTemplatedEmail = async ({
  email,
  templateType,
  templateData,
}) => {
  try {
    // Get template
    const template = emailTemplates[templateType];
    if (!template) {
      throw new Error(`Email template '${templateType}' not found`);
    }

    // Get subject and content from template
    const subject = template.subject;
    const content = template.getContent(templateData);

    // Debug log for OWNER templates
    if (templateType === "BOOKING_CONFIRMATION_OWNER") {
      console.log(
        "📧 [DEBUG] BOOKING_CONFIRMATION_OWNER content length:",
        content.length
      );
      console.log(
        "📧 [DEBUG] Content preview (first 500 chars):",
        content.substring(0, 500)
      );
      console.log(
        "📧 [DEBUG] Content preview (last 500 chars):",
        content.substring(content.length - 500)
      );
    }

    // Send email using template
    await sendEmail({
      email,
      subject,
      message: content,
    });

    logger.info("Templated email sent successfully:", {
      templateType,
      recipient: email,
      contentLength: content.length,
    });
  } catch (error) {
    logger.error("Error sending templated email:", {
      error: error.message,
      stack: error.stack,
      templateType,
      recipient: email,
    });
    throw error;
  }
};
