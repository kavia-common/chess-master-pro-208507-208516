const http = require('http');
const app = require('./app');
const { attachWebSocketServer } = require('./ws');
const { logger } = require('./utils/logger');

const PORT = process.env.PORT || process.env.REACT_APP_PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Start HTTP server and attach the WebSocket server at /ws.
 * REST API is served on the same host/port.
 */
const httpServer = http.createServer(app);

// Attach WS server
attachWebSocketServer(httpServer, { path: '/ws' });

httpServer.listen(PORT, HOST, () => {
  logger.info(`Server running at http://${HOST}:${PORT}`);
});

// Graceful shutdown
function shutdown(signal) {
  logger.info(`${signal} received: closing HTTP/WS server`);
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = httpServer;
