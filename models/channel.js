import mongoose, { Schema  } from "mongoose";

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
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPrivate: {
    type: Boolean,
    default: false
  },
  userChannels: [{
    type: Schema.Types.ObjectId,
    ref: 'UserChannel'
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  },
  // participants: [{ type: Schema.Types.ObjectId, ref: 'UserChannel' }], // List of user-channel relationships
  createdAt: { type: Date, default: Date.now },

});

channelSchema.index({ name: 1 });
channelSchema.index({ creator: 1 });
channelSchema.index({ members: 1 });
channelSchema.index({ createdAt: -1 });
channelSchema.index({ lastActivity: -1 });

channelSchema.methods = {
  async addMember(userId) {
    if (!this.members.includes(userId)) {
      this.members.push(userId);
      await this.save();
    }
  },
  async removeMember(userId) {
    this.members = this.members.filter(id => id.toString() !== userId.toString());
    await this.save();
  },
  isMember(userId) {
    return this.members.some(id => id.toString() === userId.toString());
  }
};

channelSchema.statics = {
  async getChannelsForUser(userId) {
    return this.find({
      members: userId
    }).populate('creator', 'username')
      .populate({
        path: 'userChannels',
        match: { userId: userId }
      })
      .sort({ lastActivity: -1 });
  },

  async searchChannels(query, userId) {
    return this.find({
      name: {$regex: query, $options: 'i'},
      $or: [
        { isPrivate: false },
        {
          isPrivate: true, 
          members: userId
        }
      ],
    }).populate('creator', 'username').sort({ lastActivity: -1 });
  }
}

export const Channel = mongoose.model('Channel', channelSchema);

