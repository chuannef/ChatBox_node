import mongoose, { Schema  } from "mongoose";

const userChannelSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: false },
  role: {
    type: String,
    enum: ['admin', 'member'], // Only allow these values
    default: 'member'
  },
  joinedAt: { type: Date, default: Date.now }
});

// prevent duplicate user-channel relationship
userChannelSchema.index({ user: 1, channel: 1 }, { unique: true });

export const UserChannel = mongoose.model('UserChannel', userChannelSchema);

