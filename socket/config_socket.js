import { Server } from "socket.io";

export function runningSocket(server) {
  const io = new Server(server, {
    connectionStateRecovery: {},
    // adapter: createAdapter(),
  });

  io.on('connection', async (socket) => {
    console.log(`${socket.id} is connected`);

    socket.on('disconnect', () => {
      console.log(`${socket.id} is disconnected`);
    });

    socket.on('chat message', (msg) => {
      console.log(msg);
    })

  });

}

