import { User } from '../models/user.js';
import { UserChannel } from '../models/userChannel.js';
import { Channel } from '../models/channel.js';
import { Message } from '../models/message.js';

class IndexController {
  /** 
   * GET home page. Only verify user can access to this page
   */
  static async index(req, res) {
    // const username = req.flash('username')[0];
    // const user_id = req.flash('user_id')[0];
    const user = req.user; // Take a look at ../middleware/check_login.js

    // find all channels to display in sidebar
    try {
      const channels = await Channel.find();
      const firstChannel = channels[0];
      console.log(firstChannel);

      // <!-- <div class="channel <%= currentChannelId === channel._id.toString() ? 'active' : '' %>" -->
      return res.render('index', 
        { username: user.username, 
          user_id: user.id, 
          channels: channels, 
          messages: null,
          currentChannel: firstChannel,
          currentChannelId: firstChannel._id,
          channelUsers: null });
      // return res.render('index', { username: user.username, user_id: user.id, channels: channels });
    } catch (e) {
        console.error(e);
        return res.render('index', { message: 'Something went wrong' });
    }

    // return res.render('index', { username: user.username, user_id: user.id });
    return res.render('index', 
      { username: user.username, 
        user_id: user.id, 
        channels: null, 
        messages: null,
        currentChannel: null,
        currentChannelId: null,
        channelUsers: null });
  }

  /**
   * GET channel page. Display the current activing channel and relevant
   */
  static async channel(req, res) {
    const { id } = req.params;
    if (id) {
      try {
        const channel = await Channel.findById(id);
        const user = req.user;

        if (channel) {
          // const channels = await Channel.find();
          // Get all channels with their latest message
          const channels = await Channel.aggregate([
            {
              $lookup: {
                from: 'messages',
                localField: '_id',
                foreignField: 'channel',
                pipeline: [
                  { $sort: { sentAt: -1 } },
                  { $limit: 1 },
                  {
                    $lookup: {
                      from: 'users',
                      localField: 'sender',
                      foreignField: '_id',
                      as: 'sender'
                    }
                  },
                  { $unwind: '$sender' }
                ],
                as: 'latestMessage'
              }
            },
            {
              $lookup: {
                from: 'messages',
                localField: '_id',
                foreignField: 'channel',
                pipeline: [
                  { 
                    $match: { 
                      sentAt: { 
                        $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                      } 
                    } 
                  },
                  { $count: 'count' }
                ],
                as: 'messageCount'
              }
            },
            {
              $addFields: {
                latestMessage: { $arrayElemAt: ['$latestMessage', 0] },
                messageCount: { 
                  $ifNull: [
                    { $arrayElemAt: ['$messageCount.count', 0] },
                    0
                  ]
                }
              }
            }
          ]);

          const channelUsers = await UserChannel.find({ channelId: id }).populate('userId', 'username');
          const messages = await Message.find({channel: channel._id}).populate('sender', 'username').sort({sentAt: 1});

          messages.forEach((msg) => {
            if (!msg.sender) {
              msg.sender = { username: 'Unknown user' };
            }
          });

          // <div class="channel <%= currentChannelId === channel._id ? 'active'  : '' %>">

          return res.render('index', 
            { username: user.username, 
              user_id: user.id, 
              channels: channels, 
              messages: messages,
              currentChannel: channel,
              currentChannelId: channel._id,
              channelUsers: channelUsers });

        } else {
          // Channel not found
          return res.render('index', { message: 'Channel not found' });
        }
      } catch (e) {
        console.error(e);
        return res.render('index', { message: 'Something went wrong' });
      }
    }
  }

}

export default IndexController;
