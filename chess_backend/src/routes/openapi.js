const express = require('express');
const swaggerSpec = require('../../swagger');

const router = express.Router();

function buildDynamicSpec(req) {
  const host = req.get('host');
  let protocol = req.protocol;

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

/**
 * @swagger
 * /openapi.json:
 *   get:
 *     summary: Get OpenAPI JSON specification
 *     tags: [Docs]
 *     responses:
 *       200:
 *         description: OpenAPI JSON
 */
router.get('/openapi.json', (req, res) => {
  return res.status(200).json(buildDynamicSpec(req));
});

module.exports = router;
