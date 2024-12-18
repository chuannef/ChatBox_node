import mongoose, { Schema  } from "mongoose";

const conversationSchema = new Schema({
  participants: [{
    type: Schema.Types.ObjectId, ref: 'User', required: true
  }],
  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: 'DirectMessage',
  },
  createdAt: { type: Date, default: Date.now }
});

export const Conversation = mongoose.model('Conversation', conversationSchema);
