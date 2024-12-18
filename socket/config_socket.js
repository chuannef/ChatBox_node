import { Server } from "socket.io";
import jwt from 'jsonwebtoken';

import { User } from '../models/user.js';
import { Channel } from '../models/channel.js';
import { Message } from '../models/message.js';
import { Conversation } from '../models/conversation.js';
import { UserChannel } from '../models/userChannel.js';

import {log} from "debug";

import mongoose from "mongoose";

export function initializeSocket(server) {
  const connectedUsers = new Map();
  // const userChannels = new Map();

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

      // Attach user to socket for later use
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
    socket.on('join channel', async (channelId, callback) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel) {
          throw new Error('Channel not found');
        }

        const existingRooms = Array.from(socket.rooms);
        
        // Leave all other channels
        await Promise.all(existingRooms.map(room => {
          if (room !== socket.id) {
            return socket.leave(room);
          }
        }));

        // Join new channel
        await socket.join(channelId);

        console.log(`${socket.user.username} joined channel: ${channel.name}`);

        if (typeof callback === 'function') {
          callback({
            status: 'ok',
            message: `Successfully joined channel ${channel.name}`,
            channelId: channelId
          });
        }
        // if (callback) callback({status: 'ok'});

      } catch (e) {
        console.error(e);
        if (typeof callback === 'function') {
          callback({
            status: 'error',
            error: e.message
          });
        }
      }
    });

    socket.on('new message', async (data, callback) => {
      try {
        console.log(data);
        const { content, channelId } = data;

        if (!content || !channelId) throw new Error('Invalid data');

        // Verify channel exists
        const channel = await Channel.findById(channelId);
        if (!channel) throw new Error('Channel not found'); 

        const message = new Message({
          content: content,
          sender: socket.user._id, // current user
          channel: channelId, // channel that user is in 
          timestamp: new Date()
        });

        await message.save();

        const messageData = {
          _id: message._id,
          content: message.content,
          sender: {
            _id: socket.user._id,
            username: socket.user.username
          },
          channel: channelId,
          sentAt: message.sentAt
        };

        // Return message to client
        // Test
        socket.join(channelId);
        io.to(channelId).emit('new message', messageData);
        // io.emit('message', messageData);

        if (callback) {
          callback({
            status: 'ok',
            message: messageData
          });
        }

      } catch (e) {
        console.error(e);
        // socket.emit('error', 'Failed to process message');
        console.log(e);
        if (callback) callback({ 
          status: 'error', 
          error: `Failed to process message: ${e.message}` });
      }
    });

    socket.on('chat user', () => {

    })

    /** 
     * Handle start conversation
     */
    socket.on('start conversation', async(receiverId, callback) => {
      try {
        const senderId = socket.user._id;

        let conversation = await Conversation.findOne({
          participants: { 
            $all: [senderId, receiverId]
          }
        });

        // Start a new conversation
        if (!conversation) {
          conversation = await Conversation.create({
            participants: [senderId, receiverId]
          });
        }
        console.log(`created conversation id: ${conversation._id}`);

        socket.join(`conversation:${conversation._id}`);

        if (typeof callback === 'function') {
          callback( 'ok' );
        }

      } catch (e) {
        console.error(e);
      }
    });

    socket.on('select channel', async (channelId, callback) => {
      try {
        if (!channelId) return;

        // Get all the current rooms 
        const currentRooms = Array.from(socket.rooms);

        const channelRooms = currentRooms.filter(room => 
          room !== socket.id && /^[0-9a-fA-F]{24}$/.test(room)
        );

        // Leave all the rooms
        channelRooms.forEach(room => {
          console.log(`Leaving room: ${room}`);
          socket.leave(room);
        });

        const channel = await Channel.findById(channelId);

        if (!channel) {
          if (typeof callback === 'function') {
            callback('channel is not recognised');
          }
          return socket.emit('error', 'Channel not found');
        }

        const memberCount = await UserChannel.countDocuments({ channelId });
        const messages = await Message.aggregate([
          {
            $match: { channel: channel._id }
          },
          {
            $sort: { sentAt: -1 }
          },
          {
            $limit: 50 // Get last 50 messages
          },
          {
            $lookup: {
              from: 'users',
              localField: 'sender',
              foreignField: '_id',
              as: 'sender'
            }
          },
          {
            $unwind: '$sender'
          },
          {
            $sort: { sentAt: 1 } // Sort back in ascending order for display
          }
        ]);


        console.log(socket.rooms);

        // Join a new room
        socket.join(channel._id);

        socket.emit('channel selected', { messages, channel, memberCount });

        if (typeof callback === 'function') {
          callback('success');
        }

      } catch (e) {
        console.error(e);
        socket.emit('error', 'Failed to load channel');
      }
    });

    socket.on('search channel', async (term, callback) => {
      try {
        const channels = await Channel.aggregate([
          ...(term && term.length > 0 ? [
            {
              $match: {
                name: { $regex: term, $options: 'i' }
              }
            },
          ] : []),
          {
            $lookup: {
              from: 'messages',
              localField: '_id',
              foreignField: 'channel',
              pipeline: [
                { $sort: { sentAt: -1 } },
                { $limit: 1 },
                {
                  $lookup: { from: 'users', localField: 'sender', foreignField: '_id', as: 'sender' }
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

        if (typeof callback === 'function') {
          callback('ok');
        }
        socket.emit('search channels results', channels);
      } catch (e) {
        console.error(e);
      }
    });


    socket.on('create channel', async (data, callback) => {
      try {
        const channelName = data.name.toLowerCase();

        if (!/^[a-z0-9-_]+$/.test(channelName)) {
          // Invalid channel name
          return callback({
            status: 'error',
            error: 'Channel name can only contain lowercase letters, numbers, hyphens, and underscores'
          });
        }

        const existingChannel = await Channel.findOne({ channelName });
        if (existingChannel) {
          return callback({
            status: 'error',
            error: 'Channel name already exists'
          });
        }

        const newChannel = new Channel({
          name: channelName,
          description: data.description,
          createdBy: socket.user._id,
          members: [socket.user._id]
        });

        await newChannel.save();

        io.emit('channel created', {
          _id: newChannel._id,
          name: newChannel.name,
          description: newChannel.description
        });

        callback({ status: 'ok', message: 'A new channel created successfully' });

      } catch (e) {
      }
      // if (typeof callback === 'function') {
      //   callback({ status: 'ok' });
      // }
    });

    socket.on('delete message', async (data, callback) => {
      try {
        const messageId = data;

        if (!messageId) { throw new Error('Message not found'); }

        const message = await Message.findById(messageId);

        if (!message) { throw new Error('Message not found'); } 

        if (message.sender._id.toString() !== socket.user._id.toString()) {
          throw new Error("You can't delete message that's not your");
        }

        await Message.findByIdAndDelete(messageId);

        // io.to(message.channel.toString()).emit('message deleted', { messageId } );
        io.emit('message deleted', { messageId } );

        console.log('Message deleted');

        if (callback && typeof callback === 'function') {
          callback({ status: 'ok' });
        }

      } catch (e) {
        console.error(e);
        if (callback && typeof callback === 'function') {
          callback({ status: 'error', error: 'There something went wrong' });
        }
      }
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
    });
  });

}

