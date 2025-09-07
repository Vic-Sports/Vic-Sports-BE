import mongoose from "mongoose";

const tokenBlacklistSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    // Thêm thông tin cơ bản để debug & security
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true // For fast user-based queries
    },
    tokenType: {
      type: String,
      enum: ['ACCESS_TOKEN', 'REFRESH_TOKEN'],
      default: 'ACCESS_TOKEN'
    },
    reason: {
      type: String,
      enum: ['LOGOUT', 'LOGOUT_ALL', 'PASSWORD_CHANGED', 'ADMIN_REVOKE'],
      default: 'LOGOUT'
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically remove expired tokens
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Additional indexes for common queries
tokenBlacklistSchema.index({ userId: 1, tokenType: 1 });

// Static method for easy checking
tokenBlacklistSchema.statics.isBlacklisted = async function(token) {
  const blacklistedToken = await this.findOne({ 
    token,
    expiresAt: { $gt: new Date() }
  });
  return !!blacklistedToken;
};

// Static method for blacklisting all user tokens
tokenBlacklistSchema.statics.blacklistAllUserTokens = async function(userId, reason = 'LOGOUT_ALL') {
  // This would typically be called with active tokens from your auth system
  // Since we only store blacklisted tokens, this is a placeholder
  return { success: true, message: 'Method for blacklisting all user tokens' };
};

const TokenBlacklist = mongoose.model("TokenBlacklist", tokenBlacklistSchema);

export default TokenBlacklist;