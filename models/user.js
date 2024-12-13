import mongoose, { Schema  } from "mongoose";

const user = new Schema({
  username: String, 
  password: String,
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', user);
