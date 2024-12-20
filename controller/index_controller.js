import mongoose from 'mongoose';
import {User} from '../models/user.js';
import {UserChannel} from '../models/userChannel.js';
import {Channel} from '../models/channel.js';
import {Message} from '../models/message.js';

class IndexController {
  /** 
   * GET home page. Only verify user can access to this page
   */
  static async index(req, res) {
    const user = req.user; // Take a look at ../middleware/check_login.js

    // find all channels to display in sidebar
    try {
      const controller = new IndexController();
      const channels = await controller.getChannels(user.id);

      return res.render('index', { 
        username: user.username, 
        user_id: user.id,
        channels: channels
      });
    } catch (e) {
      console.error(e);

    }
  }

  async getChannels(userId) {
    return Channel.aggregate([
      {
        $lookup: {
          from: 'userchannels',
          let: { channelId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$channelId', '$$channelId'] },
                    { $eq: ['$userId', new mongoose.Types.ObjectId(userId)] },
                    { $eq: ['$status', 'accepted'] }  // Only get accepted channels
                  ]
                }
              }
            }
          ],
          as: 'userChannel'
        }
      },
      {
        $match: {
          userChannel: { $ne: [] }  // Channel must have a UserChannel entry
        }
      },
      // Get latest message
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

      // Get creator info
      {
        $lookup: {
          from: 'users',
          localField: 'creator',
          foreignField: '_id',
          as: 'creatorInfo'
        }
      },
      // Get message count for last 24 hours
      {
        $lookup: {
          from: 'messages',
          localField: '_id',
          foreignField: 'channel',
          pipeline: [
            {
              $match: {
                sentAt: {
                  $gt: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
              }
            },
            { $count: 'count' }
          ],
          as: 'messageCount'
        }
      },
      // Format output
      {
        $addFields: {
          latestMessage: { $arrayElemAt: ['$latestMessage', 0] },
          userRole: { $arrayElemAt: ['$userChannel.role', 0] },
          userStatus: { $arrayElemAt: ['$userChannel.status', 0] },
          creator: {
            $let: {
              vars: {
                creator: { $arrayElemAt: ['$creatorInfo', 0] }
              },
              in: {
                _id: '$$creator._id',
                username: '$$creator.username'
              }
            }
          },
          messageCount: {
            $ifNull: [
              { $arrayElemAt: ['$messageCount.count', 0] },
              0
            ]
          }
        }
      },
      // Remove unnecessary fields
      {
        $project: {
          userChannel: 0,
          creatorInfo: 0
        }
      },
      // Sort by latest activity
      {
        $sort: {
          lastActivity: -1,
          'latestMessage.sentAt': -1
        }
      }
    ]);
  }

  async getUsers(currentUserId) {
    try {
      return await User.aggregate([
        {
          $match: {
            _id: {$ne: new mongoose.Types.ObjectId(currentUserId)} // Exclude current user
          }
        },
        {
          $lookup: {
            from: 'conversations',
            let: {userId: '$_id'},
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {$in: ['$$userId', '$participants']},
                      {$in: [new mongoose.Types.ObjectId(currentUserId), '$participants']}
                    ]
                  }
                }
              },
              {
                $lookup: {
                  from: 'directmessages',
                  localField: 'lastMessage',
                  foreignField: '_id',
                  as: 'lastMessage'
                }
              },
            ],
            as: 'conversation'
          }
        },
        {
          $addFields: {
            conversation: {$arrayElemAt: ['$conversation', 0]},
            lastMessage: {$arrayElemAt: ['$conversation.lastMessage', 0]}
          }
        }
      ]);
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
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
          const controller = new IndexController();
          const channels = await controller.getChannels();

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
