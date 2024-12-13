import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
const uri = process.env.MONGODB_API;

export function connectMongodb() {
  mongoose.connect(uri).then(() => console.log('connected succcessfully to MONGODB'))
  .catch(err => console.log("Cannot connected to MONGODB: ", err));
}
