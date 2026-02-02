const express = require('express');
const gameService = require('../services/game');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Games
 *     description: Create/join games, make moves, and save/load game state.
 */

/**
 * @swagger
 * /games:
 *   post:
 *     summary: Create a new chess game room
 *     tags: [Games]
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
 *               colorPreference:
 *                 type: string
 *                 enum: [white, black, random]
 *                 example: random
 *     responses:
 *       201:
 *         description: Game created
 *       400:
 *         description: Validation error
 */
router.post(
  '/games',
  asyncHandler(async (req, res) => {
    const { playerId, playerName, colorPreference } = req.body || {};
    const result = await gameService.createGame({ playerId, playerName, colorPreference });
    return res.status(201).json(result);
  })
);

/**
 * @swagger
 * /games/{gameId}:
 *   get:
 *     summary: Get the current state of a game
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Game state
 *       404:
 *         description: Not found
 */
router.get(
  '/games/:gameId',
  asyncHandler(async (req, res) => {
    const game = await gameService.getGameSnapshot(req.params.gameId);
    return res.status(200).json({ game });
  })
);

/**
 * @swagger
 * /games/{gameId}/join:
 *   post:
 *     summary: Join an existing game room
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
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
 *                 example: player_456
 *               playerName:
 *                 type: string
 *                 example: Bob
 *               colorPreference:
 *                 type: string
 *                 enum: [white, black, random]
 *                 example: random
 *     responses:
 *       200:
 *         description: Joined game
 *       409:
 *         description: Game full or seat taken
 */
router.post(
  '/games/:gameId/join',
  asyncHandler(async (req, res) => {
    const { playerId, playerName, colorPreference } = req.body || {};
    const result = await gameService.joinGame(req.params.gameId, { playerId, playerName, colorPreference });
    return res.status(200).json(result);
  })
);

/**
 * @swagger
 * /games/{gameId}/move:
 *   post:
 *     summary: Apply a move via REST (fallback; server-authoritative)
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [playerId, from, to]
 *             properties:
 *               playerId:
 *                 type: string
 *                 example: player_123
 *               from:
 *                 type: string
 *                 example: e2
 *               to:
 *                 type: string
 *                 example: e4
 *               promotion:
 *                 type: string
 *                 enum: [q, r, b, n]
 *                 example: q
 *     responses:
 *       200:
 *         description: Move applied; returns updated game and move
 *       400:
 *         description: Illegal move / validation error
 *       403:
 *         description: Not your turn
 */
router.post(
  '/games/:gameId/move',
  asyncHandler(async (req, res) => {
    const { playerId, from, to, promotion } = req.body || {};
    const result = await gameService.applyMove(req.params.gameId, { playerId, from, to, promotion });
    return res.status(200).json(result);
  })
);

/**
 * @swagger
 * /games/{gameId}/save:
 *   post:
 *     summary: Force-save a game snapshot to disk
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Saved snapshot
 */
router.post(
  '/games/:gameId/save',
  asyncHandler(async (req, res) => {
    const game = await gameService.saveGame(req.params.gameId);
    return res.status(200).json({ game });
  })
);

/**
 * @swagger
 * /games/{gameId}/load:
 *   get:
 *     summary: Load a game from disk into memory (if saved)
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Loaded game snapshot
 *       404:
 *         description: Not found
 */
router.get(
  '/games/:gameId/load',
  asyncHandler(async (req, res) => {
    const game = await gameService.getGameSnapshot(req.params.gameId);
    return res.status(200).json({ game });
  })
);

module.exports = router;
