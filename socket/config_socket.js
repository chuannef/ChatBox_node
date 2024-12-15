import { Server } from "socket.io";
import jwt from 'jsonwebtoken';

import { User } from '../models/user.js';
import { Channel } from '../models/channel.js';

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

    socket.on('chat', (msg, callback) => {
      try {
        console.log(`Received message from: ${socket.user.username}: ${msg}`);
        // Return message to client
        io.emit('message', {
          content: msg,
          username: socket.user.username,
          userId: socket.user._id,
          timestamp: new Date()
        });
        // Back to the client. Prevent delay and emit multiple time
        if (typeof callback === 'function') {
          callback({ status: 'ok' });
        }

      } catch (e) {
        console.error(e);
        // socket.emit('error', 'Failed to process message');
        if (typeof callback === 'function') {
          callback({ status: 'error', message: error.message });
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

