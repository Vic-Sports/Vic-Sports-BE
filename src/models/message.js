import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    content: { type: String, required: true },
    type: { type: String, enum: ["text", "image", "file"], default: "text" },
    fileUrl: String,
    fileName: String,
    fileSize: Number,

    deliveredTo: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        deliveredAt: { type: Date, default: Date.now }
      }
    ],
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now }
      }
    ],

    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },

    isEdited: { type: Boolean, default: false },
    editedAt: Date,

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    sentAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

messageSchema.index({ chatId: 1, sentAt: -1 });
messageSchema.index({ senderId: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
