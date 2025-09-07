const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    ],
    type: { type: String, enum: ["direct", "group"], default: "direct" },
    name: String,
    avatar: String,

    lastMessage: {
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      content: String,
      type: { type: String, enum: ["text", "image", "file"], default: "text" },
      sentAt: Date
    },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });
const Chat = mongoose.model("Chat", chatSchema);

export default Chat;
