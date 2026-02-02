const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const { ApiError } = require('./utils/apiError');
const { logger } = require('./utils/logger');

// Initialize express app
const app = express();

function buildDynamicSpec(req) {
  const host = req.get('host'); // may or may not include port
  let protocol = req.protocol; // http or https

  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');

  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
      (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  return {
    ...swaggerSpec,
    servers: [{ url: `${protocol}://${fullHost}` }],
  };
}

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.set('trust proxy', true);

app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const dynamicSpec = buildDynamicSpec(req);
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Parse JSON request body
app.use(express.json({ limit: '256kb' }));

// Mount routes
app.use('/', routes);

// 404 handler
app.use((req, res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`));
});

// Error handling middleware
app.use((err, req, res, next) => {
  // eslint-disable-line no-unused-vars
  const statusCode = err && err.statusCode ? err.statusCode : 500;
  const code = err && err.code ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = err && err.message ? err.message : 'Internal Server Error';

  logger.error('Request failed', {
    statusCode,
    code,
    message,
    path: req.path,
    method: req.method,
    details: err && err.details ? err.details : undefined,
  });

  return res.status(statusCode).json({
    status: 'error',
    code,
    message,
    details: err && err.details ? err.details : undefined,
  });
});

module.exports = app;
