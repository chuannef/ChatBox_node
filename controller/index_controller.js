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
      return res.render('index', { username: user.username, user_id: user.id, channels: channels });
    } catch (e) {
        console.error(e);
        return res.render('index', { message: 'Something went wrong' });
    }

    return res.render('index', { username: user.username, user_id: user.id });
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
          const channels = await Channel.find();
          const channelUsers = await UserChannel.find({ channelId: id }).populate('userId', 'username');
          const messages = await Message.find({channel: channel._id}).populate('sender', 'username').sort({sentAt: 1});

          messages.forEach((msg) => {
            if (!msg.sender) {
              msg.sender = { username: 'Unknown user' };
            }
          });

          return res.render('index', 
            { username: user.username, 
              user_id: user.id, 
              channels: channels, 
              messages: messages,
              currentChannel: channel,
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
