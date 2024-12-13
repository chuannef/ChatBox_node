import mongoose, { Schema  } from "mongoose";

const user = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    min: 4,
    max: 12,
    match: /^[a-zA-Z0-9_]+$/
  }, 
  password: {
    type: String,
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', user);
