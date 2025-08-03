const mongoose = require("mongoose");

const subFieldSchema = new mongoose.Schema(
  {
    sportField: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SportField",
      required: true
    },
    name: {
      type: String,
      required: true // ví dụ: "Sân số 1", "Sân A"
    },
    note: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubField", subFieldSchema);
