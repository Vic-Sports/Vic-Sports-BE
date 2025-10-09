import { google } from "googleapis";
import { getAuthenticatedClientForUser } from "../config/googleAuth.js";
import FormRecord from "../models/FormRecord.js";

/**
 * Creates a dynamic Google Form for booking purposes.
 * @param {Object} formConfig - Configuration for the form.
 * @param {string} formConfig.title - The title of the form.
 * @param {Array<Object>} formConfig.items - An array of form items/questions.
 * @returns {Promise<Object>} The created form's metadata.
 */
/**
 * Creates a dynamic Google Form and linked Sheet for a specific user.
 * @param {string} ownerId - ID of the user creating the form
 * @param {Object} formConfig - Configuration for the form.
 * @param {string} formConfig.title - The title of the form.
 * @param {Array<Object>} formConfig.items - An array of form items/questions.
 * @returns {Promise<Object>} The created form's metadata including spreadsheetId.
 */
export async function createDynamicBookingForm(ownerId, { title, items }) {
  // Pre-flight: ensure the user is an owner and has active googleGroupStatus
  const User = (await import("../models/user.js")).default;
  const user = await User.findById(ownerId).lean();
  if (!user) throw new Error("User not found");
  if (user.role !== "owner") {
    throw new Error("Only owner accounts can create Google Forms.");
  }
  if (user.googleGroupStatus !== "active") {
    // Friendly, actionable error for frontend display
    const err = new Error(
      "Your owner account is pending final activation. Please wait for the administrator to confirm your access."
    );
    err.code = "OWNER_GOOGLE_GROUP_PENDING";
    throw err;
  }

  const authClient = await getAuthenticatedClientForUser(ownerId);
  const forms = google.forms({ version: "v1", auth: authClient });

  // Create the form with title only (description updated via batchUpdate)
  // Create the form
  const createRes = await forms.forms.create({
    requestBody: { info: { title } },
  });

  const formId = createRes.data.formId;

  // Build update requests: description, image, questions
  const updateRequests = [];
  const config = arguments[1];
  if (config.description) {
    updateRequests.push({
      updateFormInfo: {
        info: { description: config.description },
        updateMask: "description",
      },
    });
  }
  if (config.imageUrl) {
    updateRequests.push({
      createItem: {
        item: { imageItem: { image: { sourceUri: config.imageUrl } } },
        location: { index: 0 },
      },
    });
  }
  items.forEach((item, idx) => {
    const loc = config.imageUrl ? idx + 1 : idx;
    const question = { required: item.required || false };
    if (item.type === "multipleChoice") {
      question.choiceQuestion = {
        type: "RADIO",
        options: (item.options || []).map((opt) => ({ value: opt })),
        shuffle: false,
      };
    } else {
      const key = `${item.type || "text"}Question`;
      question[key] = {};
    }
    updateRequests.push({
      createItem: {
        item: { title: item.title, questionItem: { question } },
        location: { index: loc },
      },
    });
  });
  // Apply form layout updates
  if (updateRequests.length) {
    await forms.forms.batchUpdate({
      formId,
      requestBody: { requests: updateRequests },
    });
  }
  // Create linked Google Sheet for responses
  const drive = google.drive({ version: "v3", auth: authClient });
  const sheetRes = await drive.files.create({
    resource: {
      name: `${title} Responses`,
      mimeType: "application/vnd.google-apps.spreadsheet",
    },
    fields: "id",
  });
  const spreadsheetId = sheetRes.data.id;
  // Link form to spreadsheet for responses
  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [
        {
          updateSettings: {
            settings: { destination: { type: "SPREADSHEET", spreadsheetId } },
            updateMask: "destination.spreadsheetId",
          },
        },
      ],
    },
  });
  // Save record to DB
  await FormRecord.create({ formId, spreadsheetId, ownerId });
  // Return form metadata and sheet ID
  return { ...createRes.data, spreadsheetId };
}

/**
 * Retrieves an existing Google Form by ID.
 * @param {string} formId - The ID of the form to retrieve.
 * @returns {Promise<Object>} The form metadata.
 */
export async function getForm(formId) {
  const authClient = await getAuthenticatedClient();
  const forms = google.forms({ version: "v1", auth: authClient });
  const res = await forms.forms.get({ formId });
  return res.data;
}
