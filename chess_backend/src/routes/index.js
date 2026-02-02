const express = require('express');
const healthController = require('../controllers/health');

const gamesRoutes = require('./games');
const matchmakingRoutes = require('./matchmaking');
const wsInfoRoutes = require('./wsInfo');
const openapiRoutes = require('./openapi');

const router = express.Router();
// Health endpoint

/**
 * @swagger
 * tags:
 *   - name: Health
 *     description: Service health checks.
 *   - name: Docs
 *     description: API documentation helpers.
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

// API routes
router.use(gamesRoutes);
router.use(matchmakingRoutes);
router.use(wsInfoRoutes);
router.use(openapiRoutes);

module.exports = router;
