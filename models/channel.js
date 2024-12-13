const channelSchema = new Schema({
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    participants: [{ type: Schema.Types.ObjectId, ref: 'UserChannel' }], // List of user-channel relationships
    createdAt: { type: Date, default: Date.now }
  });
  
  export const Channel = mongoose.model('Channel', channelSchema);
  