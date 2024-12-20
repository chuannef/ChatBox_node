import { Server } from "socket.io";
import jwt from 'jsonwebtoken';

import { availableParallelism } from 'node:os';
import cluster from 'node:cluster';
import { createAdapter, setupPrimary } from '@socket.io/cluster-adapter';

import { User } from '../models/user.js';
import { Channel } from '../models/channel.js';
import { Message } from '../models/message.js';
import { Conversation } from '../models/conversation.js';
import { UserChannel } from '../models/userChannel.js';

import {log} from "debug";

import mongoose from "mongoose";

import IndexController from '../controller/index_controller.js';

export function initializeSocket(server) {
  const connectedUsers = new Map();

  const io = new Server(server, {
    connectionStateRecovery: {},
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

    if (socket.user?._id) {
      /*
       * this is because when we need to send a notification to a user
       * we will need to know their address and this socket.user._id will be 
       * the address.
       */
      socket.join(socket.user?._id.toString());
      console.log(`User ${socket.user.username} joined session: ${socket.user._id}`);
    }

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

    socket.on('delete channel', async (channelId, callback) => {
      try {
        if (!channelId) {
          return callback({ status: 'error', error: 'ChannelId is invalid' });
        }

        const existingChannel = await Channel.findById(channelId);
        if (!existingChannel) {
          return callback({ status: 'error', error: 'Channel not found' });
        }

        await Channel.findByIdAndDelete(channelId);

        callback({ status: 'ok', message: 'Delete successfully' });

      } catch (e) {
        console.error(e);
        return callback({ status: 'error', error: 'There something went wrong, please log out and login back.' });
      }
    });
    

    socket.on('new message', async (data, callback) => {
      try {
        // console.log(data);
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

        // Check if user have already joined in
        const userChannel = await UserChannel.findOne({
          userId: socket.user._id,
          channelId: channelId,
        });

        if (!userChannel || userChannel?.status === 'pending' || userChannel?.status === 'rejected') {
          return callback({ status: 'error', error: 'You can not chat on this channel unless you have taken part in' });
        }

        if (!userChannel) {
          const newUserChannel = new UserChannel({
            userId: socket.user._id,
            channelId: channelId,
            joinedAt: new Date(),
          });

          await newUserChannel.save();
          await Channel.findByIdAndUpdate(channelId, {
            $push: { participants: newUserChannel._id }
          });

        }

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

        io.to(channelId.toString()).emit('new message', messageData);

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
          if (room !== socket.user._id.toString()) {
            console.log(`Leaving room: ${room}`);
            socket.leave(room);
          }
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

        socket.join(channel._id.toString());
        io.to(socket.user._id.toString()).emit('channel selected', { messages, channel, memberCount });
        // socket.emit('channel selected', { messages, channel, memberCount });

        if (typeof callback === 'function') {
          callback('success');
        }

      } catch (e) {
        console.error(e);
        socket.emit('error', 'Failed to load channel');
      }
    });

    socket.on('respond to join channel', async (data, callback) => {
      // console.log(data);
    });

    /**
     * Managed to notification to user
     */
    socket.on('request join channel', async (channelId, callback) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel) {
          return callback ({ status: 'error', error: 'Channel not found' });
        }

        const existingUserChannel = await UserChannel.findOne({
          userId: socket.user._id,
          channelId: channelId
        });

        if (existingUserChannel) {
          return callback({
            status: 'error',
            error: 'Already requested or member of this channel'
          });
        }

        const userChannel = new UserChannel({
          userId: socket.user._id,
          channelId: channelId,
          status: 'pending',
          role: 'member'
        });

        await userChannel.save();

        const channelAdmin = await UserChannel.findOne({
          channelId: channelId,
          role: 'admin',
        });

        if (!channelAdmin) {
          return callback({ status: 'error', error: 'Admin of this channel not found' });
        }

        const connectedClients = Array.from(io.sockets.sockets.keys());
        console.log('Connected clients: ', connectedClients);

        const notificationData = {
          channelId: channelId,
          channelName: channel.name,
          requestingUser: {
            id: socket.user._id,
            username: socket.user.username
          },
          requestId: userChannel._id
        }

        const adminRoom = channelAdmin.userId.toString();
        const roomClients = io.sockets.adapter.rooms.get(adminRoom);
        if (!roomClients) {
          console.log(`Admin ${adminRoom} is not connected`);
          callback({ status: 'error', error: 'Admin is not connected'});
        }
        io.to(adminRoom).emit('join request notification', notificationData);

        // Send notification to admin of this channel
        // if (channelAdmin) {
        //   io.to(channelAdmin.userId.toString()).emit('join request notification', {
        //     channelId: channelId,
        //     channelName: channel.name,
        //     requestingUser: {
        //       id: socket.user._id,
        //       username: socket.user.username
        //     },
        //     requestId: userChannel._id
        //   });
        // }
        callback({ status: 'ok' });
      } catch (e) {
        console.error(e);
        callback({ status: 'error', error: 'Failed to process join channel' });
      }
    });

    socket.on('search channels', async (term, callback) => {
      try {
        let channels = [];
        if (term.length <= 0) {
          const index = new IndexController();
          channels = await index.getChannels(socket.user._id);
        }
        else {
          channels = await Channel.aggregate([
            ...(term && term.length > 0 ? [
              // Match the search `term`
              {
                $match: {
                  name: { $regex: term, $options: 'i' },
                  $or: [
                    { isPrivate: false },
                    { 
                      isPrivate: true,
                      $or: [
                        { creator: socket.user._id },
                        { members: socket.user._id },
                      ]
                    }
                  ]
                }
              },
            ] : []),
            // Look for latest message
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
        }

        if (typeof callback === 'function') {
          callback( { status: 'ok', message: 'Search response from server' });
        }

        socket.emit('search channels results', channels);

      } catch (e) {
        console.error(e);
      }
    });

    socket.on('invite users', async ({ channelId, userIds }, callback) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel) {
          if (typeof callback === 'function') {
            return callback({ status: 'error', message: 'Channel not found' });
          }
        }

        // const invites = userIds.map(userId => ({ 
        //   userId,
        //   channelId,
        //   role: 'member',
        //   status: 'pending',
        //   joinedAt: new Date(),
        // }));

        // await UserChannel.insertMany(invites);

        userIds.forEach(userId => {
          io.to(userId.toString()).emit('channel invite', {
            channelId: channel._id,
            channelName: channel.name,
            invitedBy: socket.user.username,
          });
        });

        socket.emit('invite results', {
          status: 'ok',
          message: 'Invitations sent successfully',
        });

      } catch (e) {
        console.log(e);
      }
    });

    socket.on('accept channel invite', async ({ channelId }, callback) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel) {
          if (typeof callback === 'function') {
            return callback({ status: 'error', message: 'Channel not found' });
          }
        }

        const existingMembership = await UserChannel.findOne({
          userId: socket.user._id,
          channelId: channelId
        });

        if (existingMembership) {
          return callback({
            status: 'error',
            error: 'You are already a member of this channel'
          });
        }

        const newUserChannel = new UserChannel({
          userId: socket.user._id,
          channelId: channel._id,
          role: 'member',
          status: 'accepted',
          joinedAt: new Date(),
          lastRead: new Date(),
        });

        await newUserChannel.save();

        return callback({
          status: 'ok',
          message: 'You have accepted the invitation.',
          channel: channel
        });

      } catch (e) {
        console.log(e);
      }
    });

    socket.on('search users', async ({ query, channelId }, callback) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel) {
          callback({ status: 'error', error: 'Channel not found' });
        }
        
        const existingMembers = await UserChannel.find({
          channelId: channelId
        }).distinct('userId');


        const users = await User.find({
          username: { $regex: query, $options: 'i' },
          _id: {
            // $nin: existingMembers,
            $ne: socket.user._id // exclude current user
          }
        }).limit(10);

        io.to(channelId.toString()).emit('search user results', users);

      } catch(e) {
        console.log(e);
        // callback({ status: 'error', error: 'Something went wrong, please log out and login back' });
      }
    });

    socket.on('create channel', async (data, callback) => {
      try {
        const channelName = data.name.trim();

        if (!data || !data.name) {
          return callback({
            status: 'error',
            error: 'Invalid data'
          });
        }

        if (!/^[a-z0-9-_]+$/.test(channelName)) {
          // Invalid channel name
          return callback({
            status: 'error',
            error: 'Channel name can only contain lowercase letters, numbers, hyphens, and underscores'
          });
        }

        const existingChannel = await Channel.findOne({ name: channelName });
        if (existingChannel) {
          return callback({
            status: 'error',
            error: 'Channel name already exists'
          });
        }

        const newChannel = new Channel({
          name: channelName,
          description: data.description,
          creator: socket.user._id,
          members: [socket.user._id],
          isPrivate: Boolean(data.isPrivate) || false,
          lastActivity: new Date(),
          createdAt: new Date(),
        });

        await newChannel.save();

        // Create user and channel relationship
        const userChannel = new UserChannel({
          userId: socket.user._id,
          channelId: newChannel._id,
          role: 'admin',
          status: 'accepted',
          joinedAt: new Date(),
          lastRead: new Date()
        });

        await userChannel.save();

        io.emit('channel created', {
          _id: newChannel._id,
          name: newChannel.name,
          description: newChannel.description,
          messageCount: 0,
        });

        callback({
          status: 'ok',
          channel: {
            _id: newChannel._id,
            name: newChannel.name,
            description: newChannel.description,
            isPrivate: newChannel.isPrivate,
            creator: {
              _id: socket.user._id,
              username: socket.user.username,
            },
            messageCount: 0,
            latestMessage: null,
            userRole: 'admin',
            userStatus: 'accepted',
            createdAt: newChannel.createdAt,
            lastActivity: newChannel.lastActivity,
          },
          message: 'A new channel created successfully'
        });

      } catch (e) {
        console.error(e.message);
        callback({
          status: 'error',
          error: 'Failed to create channel. Please try again.'
        }); 
      }
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

