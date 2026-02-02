const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chess Backend API',
      version: '1.0.0',
      description:
        'Express backend for multiplayer chess: REST endpoints for game/session management and a WebSocket endpoint for real-time play with server-authoritative move validation.',
    },
    tags: [
      { name: 'Health', description: 'Service health checks.' },
      { name: 'Games', description: 'Create/join games, make moves, save/load state.' },
      { name: 'Matchmaking', description: 'Match players into new games.' },
      { name: 'Realtime', description: 'WebSocket protocol and real-time usage.' },
      { name: 'Docs', description: 'Documentation helpers.' },
    ],
  },
  apis: ['./src/routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
