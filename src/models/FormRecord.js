import mongoose from "mongoose";

const formRecordSchema = new mongoose.Schema(
  {
    formId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    spreadsheetId: {
      type: String,
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const FormRecord = mongoose.model("FormRecord", formRecordSchema);
export default FormRecord;
