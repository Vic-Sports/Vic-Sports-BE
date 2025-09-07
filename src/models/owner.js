import mongoose from "mongoose";

const ownerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    businessName: { type: String, required: true },
    businessLicense: { type: String, required: true },
    taxCode: String,
    bankAccount: {
      bankName: String,
      accountNumber: String,
      accountName: String
    },
    isVerified: { type: Boolean, default: false },
    verificationDocuments: [String],
    totalRevenue: { type: Number, default: 0 }
  },
  { timestamps: true }
);

ownerProfileSchema.index({ userId: 1 });

const Owner = mongoose.model("Owner", ownerProfileSchema);

export default Owner;
