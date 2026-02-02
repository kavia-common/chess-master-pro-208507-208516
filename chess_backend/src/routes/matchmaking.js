const express = require('express');
const matchmakingService = require('../services/matchmaking');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Matchmaking
 *     description: Simple matchmaking queue that pairs players into new games.
 */

/**
 * @swagger
 * /matchmaking/join:
 *   post:
 *     summary: Join matchmaking queue
 *     tags: [Matchmaking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [playerId, playerName]
 *             properties:
 *               playerId:
 *                 type: string
 *                 example: player_123
 *               playerName:
 *                 type: string
 *                 example: Alice
 *     responses:
 *       200:
 *         description: Waiting or matched
 */
router.post(
  '/matchmaking/join',
  asyncHandler(async (req, res) => {
    const { playerId, playerName } = req.body || {};
    const result = await matchmakingService.joinMatchmaking({ playerId, playerName });
    return res.status(200).json(result);
  })
);

/**
 * @swagger
 * /matchmaking/leave:
 *   post:
 *     summary: Leave matchmaking queue
 *     tags: [Matchmaking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [playerId]
 *             properties:
 *               playerId:
 *                 type: string
 *                 example: player_123
 *     responses:
 *       200:
 *         description: Left or not_waiting
 */
router.post(
  '/matchmaking/leave',
  asyncHandler(async (req, res) => {
    const { playerId } = req.body || {};
    const result = await matchmakingService.leaveMatchmaking({ playerId });
    return res.status(200).json(result);
  })
);

/**
 * @swagger
 * /matchmaking/status:
 *   get:
 *     summary: Get matchmaking status for a playerId
 *     tags: [Matchmaking]
 *     parameters:
 *       - in: query
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status
 */
router.get(
  '/matchmaking/status',
  asyncHandler(async (req, res) => {
    const result = await matchmakingService.getMatchmakingStatus(req.query.playerId);
    return res.status(200).json(result);
  })
);

module.exports = router;
