const express = require('express');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Realtime
 *     description: WebSocket protocol and real-time multiplayer usage.
 */

/**
 * @swagger
 * /ws-info:
 *   get:
 *     summary: WebSocket usage info
 *     tags: [Realtime]
 *     responses:
 *       200:
 *         description: Connection details and message formats
 */
router.get('/ws-info', (req, res) => {
  const host = req.get('host');
  const protocol = req.secure ? 'wss' : 'ws';
  return res.status(200).json({
    websocket: {
      url: `${protocol}://${host}/ws`,
      notes: [
        'Connect to /ws, then send a JSON message: { "type": "join", "gameId": "...", "playerId": "..." }',
        'Moves are server-authoritative: castling, en passant, promotion, and check/checkmate/stalemate are validated.',
      ],
      messages: {
        join: { type: 'join', gameId: 'string', playerId: 'string (optional; seated players only)' },
        sync: { type: 'sync' },
        move: { type: 'move', from: 'e2', to: 'e4', promotion: 'q|r|b|n (optional)' },
        leave: { type: 'leave' },
      },
      serverEmits: {
        joined: { type: 'joined', game: 'GameSnapshot', yourColor: 'white|black|null' },
        state: { type: 'state', game: 'GameSnapshot' },
        move_applied: { type: 'move_applied', game: 'GameSnapshot', move: 'chess.js verbose move object' },
        error: { type: 'error', code: 'string', message: 'string', details: 'object (optional)' },
      },
    },
  });
});

module.exports = router;
