// import {Server} from 'socket.io';
import {createServer} from 'http';

export function configServer(app) {
  /**
   * Setup socket.io
   */
  const port = normalizePort(process.env.PORT || '3000');
  app.set('port', port);

  const server = createServer(app);

  // const io = new Server(server, {
  //   connectionStateRecovery: {},
  //   adapter: createAdapter(),
  // });

  server.listen(port);

  function normalizePort(val) {
    const port = parseInt(val, 10);
    if (isNaN(port)) {
      // named pipe
      return val;
    }
    if (port >= 0) {
      // port number
      return port;
    }
    return false;
  }

}
