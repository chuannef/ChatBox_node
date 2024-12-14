const userChannelSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
  role: { 
    type: String, 
    enum: ['member', 'admin'], 
    default: 'member' 
  },
  joinedAt: { type: Date, default: Date.now }
});

export const UserChannel = mongoose.model('UserChannel', userChannelSchema);

