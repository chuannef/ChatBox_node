import mongoose, { Schema } from "mongoose";

const directMessage = new Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversation: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  sentAt: { type: Date, default: Date.now }
});

export const DirectMessage = mongoose.model('DirectMessage', directMessage);
