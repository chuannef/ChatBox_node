import { Server } from "socket.io";
import jwt from 'jsonwebtoken';

import { User } from '../models/user.js';
import { Channel } from '../models/channel.js';
import { Message } from '../models/message.js';

export function initializeSocket(server) {
  const connectedUsers = new Map();

  const io = new Server(server, {
    connectionStateRecovery: {},
    // adapter: createAdapter(),
  });

  // socket authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error'));
      }
      // Decode jwt
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      /** decoded cookie looks like this
        {
          user_id: '65c008103c381bb4b73eb',
          username: 'chinhcom',
          iat: 1734176250,
          exp: 1734179850
        }
       */
      const user = await User.findById(decoded.user_id);
      if (!user) {
        return next(new Error('User not found'));
      }

      if (connectedUsers.has(user._id.toString())) {
        const existingSocket = connectedUsers.get(user._id.toString());
        existingSocket.disconnect();
      }

      socket.user = user;
      connectedUsers.set(user._id.toString(), socket);
      next();
    } catch (e) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`${socket.user.username} is connected`);
    // TODO: implement user online status 
    // await User.findByIdAndUpdate(socket.user._id);

    // socket.emit('join channel', channelId)
    socket.on('join channel', async (channelId) => {
      try {
        const channel = await Channel.findById(channelId);
        if (channel) {
          socket.join(channelId);
          console.log(`${socket.user.username} joined channel: ${channel.name}`);
        }
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('chat', async (data, callback) => {
      console.log('RECEIVED SOME DATA FROM CLIENT');
      console.log(data);

      try {
        console.log(`Received message from: ${socket.user.username}`);
        const { content, channelId } = data;
        // Verify channel exists
        const channel = await Channel.findById(channelId);
        if (!channel) {
          throw new Error('Channel not found');
        }

        const message = new Message({
          content: content,
          sender: socket.user._id, // current user
          channel: channelId, // channel that user is in 
          timestamp: new Date()
        });

        await message.save();

        // Return message to client
        // io.to(channelId).emit('message', {
        io.emit('message', {
          _id: message._id,
          content: message.content,
          sender: {
            _id: socket.user._id,
            username: socket.user.username
          },
          channel: channelId,
          sentAt: message.sentAt
        });

        // Back to the client. Prevent delay and emit multiple time
        if (typeof callback === 'function') {
          console.log('Im a function');
          callback({ 
            status: 'ok',
            message: {
              _id: message._id,
              content: message.content,
              sender: {
                _id: socket.user._id,
                username: socket.user.username,
              },
              channel: channelId,
              sentAt: message.sentAt
            }
          });
        }

      } catch (e) {
        console.error(e);
        // socket.emit('error', 'Failed to process message');
        if (typeof callback === 'function') {
          console.log('complete');
          callback({ status: 'error', message: e.message });
        }
      }
      // console.log(msg);
      // io.emit('chat', msg);
    });

    socket.on('disconnect', async () => {
      console.log(`${socket.id} is disconnected`);
      connectedUsers.delete(socket.user._id.toString());
    });

  });

}

export function runningSocket(server) {
  const io = new Server(server, {
    connectionStateRecovery: {},
    // adapter: createAdapter(),
  });

  io.on('connection', async (socket) => {
    console.log(`${socket.id} is connected`);

    // const user = socket.user;
    socket.on('disconnect', () => {
      console.log(`${socket.id} is disconnected`);
    });

    socket.on('chat message', (msg) => {
      console.log(msg);
      io.emit('chat message', msg);
    })

  });

}

