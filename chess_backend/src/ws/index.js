const { WebSocketServer } = require('ws');
const gameService = require('../services/game');
const { logger } = require('../utils/logger');

function safeJsonParse(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function send(ws, type, payload) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, ...payload }));
}

function roomKey(gameId) {
  return String(gameId);
}

function computeClientIdentity(ws) {
  return {
    playerId: ws.playerId || null,
    gameId: ws.gameId || null,
  };
}

// PUBLIC_INTERFACE
function attachWebSocketServer(httpServer, { path = '/ws' } = {}) {
  /** Attach a WebSocket server to an existing HTTP server. */
  const wss = new WebSocketServer({ server: httpServer, path });

  /** @type {Map<string, Set<import('ws').WebSocket>>} */
  const rooms = new Map();

  function addToRoom(gameId, ws) {
    const key = roomKey(gameId);
    if (!rooms.has(key)) rooms.set(key, new Set());
    rooms.get(key).add(ws);
  }

  function removeFromRoom(ws) {
    if (!ws.gameId) return;
    const key = roomKey(ws.gameId);
    const set = rooms.get(key);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) rooms.delete(key);
  }

  async function broadcastState(gameId) {
    const key = roomKey(gameId);
    const set = rooms.get(key);
    if (!set) return;

    const snapshot = await gameService.getGameSnapshot(gameId);
    for (const client of set) {
      send(client, 'state', { game: snapshot });
    }
  }

  async function handleJoin(ws, msg) {
    const { gameId, playerId } = msg;
    if (!gameId || typeof gameId !== 'string') {
      send(ws, 'error', { code: 'INVALID_GAME_ID', message: 'join requires gameId.' });
      return;
    }

    try {
      const game = await gameService.getOrLoadGame(gameId);
      ws.gameId = gameId;
      ws.playerId = playerId || null;

      addToRoom(gameId, ws);

      // Determine role/color if seated
      let yourColor = null;
      if (playerId && game.players.white && game.players.white.id === playerId) yourColor = 'white';
      if (playerId && game.players.black && game.players.black.id === playerId) yourColor = 'black';

      send(ws, 'joined', { game: await gameService.getGameSnapshot(gameId), yourColor });
      await broadcastState(gameId);
    } catch (err) {
      send(ws, 'error', { code: err.code || 'JOIN_FAILED', message: err.message || 'Join failed.' });
    }
  }

  async function handleSync(ws) {
    if (!ws.gameId) {
      send(ws, 'error', { code: 'NOT_IN_GAME', message: 'sync requires join first.' });
      return;
    }
    const game = await gameService.getGameSnapshot(ws.gameId);
    send(ws, 'state', { game });
  }

  async function handleMove(ws, msg) {
    const { from, to, promotion } = msg;
    if (!ws.gameId) {
      send(ws, 'error', { code: 'NOT_IN_GAME', message: 'move requires join first.' });
      return;
    }
    if (!ws.playerId) {
      send(ws, 'error', { code: 'NOT_A_PLAYER', message: 'move requires a playerId (seat must be taken via REST join).' });
      return;
    }

    try {
      const result = await gameService.applyMove(ws.gameId, {
        playerId: ws.playerId,
        from,
        to,
        promotion,
      });

      // Broadcast authoritative state + last move
      const key = roomKey(ws.gameId);
      const set = rooms.get(key);
      if (set) {
        for (const client of set) {
          send(client, 'move_applied', { game: result.game, move: result.move });
        }
      }
    } catch (err) {
      send(ws, 'error', {
        code: err.code || 'MOVE_FAILED',
        message: err.message || 'Move failed.',
        details: err.details || undefined,
      });
    }
  }

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.gameId = null;
    ws.playerId = null;

    logger.info('WS connected', { url: req.url });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      const raw = data.toString();
      const parsed = safeJsonParse(raw);
      if (!parsed.ok) {
        send(ws, 'error', { code: 'INVALID_JSON', message: 'Message must be valid JSON.' });
        return;
      }

      const msg = parsed.value || {};
      const type = msg.type;

      try {
        if (type === 'join') {
          await handleJoin(ws, msg);
          return;
        }
        if (type === 'sync') {
          await handleSync(ws);
          return;
        }
        if (type === 'move') {
          await handleMove(ws, msg);
          return;
        }
        if (type === 'leave') {
          removeFromRoom(ws);
          ws.gameId = null;
          send(ws, 'left', { ok: true });
          return;
        }

        send(ws, 'error', { code: 'UNKNOWN_TYPE', message: 'Unknown message type.', receivedType: type });
      } catch (err) {
        logger.error('WS message handler failed', { err, identity: computeClientIdentity(ws) });
        send(ws, 'error', { code: 'WS_INTERNAL_ERROR', message: 'Internal server error.' });
      }
    });

    ws.on('close', () => {
      removeFromRoom(ws);
      logger.info('WS closed', computeClientIdentity(ws));
    });

    ws.on('error', (err) => {
      logger.warn('WS error', { err, identity: computeClientIdentity(ws) });
    });
  });

  // Heartbeat to terminate broken connections
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch (e) {
          // ignore
        }
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  return wss;
}

module.exports = { attachWebSocketServer };
