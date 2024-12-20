import mongoose, { Schema  } from "mongoose";

const userChannelSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
  role: {
    type: String,
    enum: ['admin', 'member'], // Only allow these values
    default: 'member'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  joinedAt: { type: Date, default: Date.now },
  lastRead: {
    type: Date,
    default: Date.now
  }
});

userChannelSchema.index({ 
  unique: true,
  name: 'userId_channelId_unique'
});

export const UserChannel = mongoose.model('UserChannel', userChannelSchema);

