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
  server.on('error', onError);
  server.on('listening', onListening);

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

  function onError(error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind = typeof port === 'string'
      ? 'Pipe ' + port
      : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  /**
   * Event listener for HTTP server "listening" event.
   */

  function onListening() {
    console.log(`Server listing on port: ${port}`);
    var addr = server.address();
    var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
    debug('Listening on ' + bind);
  }
}
