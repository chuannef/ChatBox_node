import mongoose, { Schema } from "mongoose";

const message = new Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true
  },
  sentAt: { type: Date, default: Date.now }
});

export const Message = mongoose.model('Message', message);
