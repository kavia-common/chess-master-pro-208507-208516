const { ApiError } = require('../utils/apiError');
const gameService = require('./game');

/** @type {Map<string, {playerId: string, playerName: string, joinedAt: string}>} */
const waiting = new Map();

function nowIso() {
  return new Date().toISOString();
}

// PUBLIC_INTERFACE
async function joinMatchmaking({ playerId, playerName }) {
  /** Join matchmaking queue. If another player is waiting, create a game and match immediately. */
  if (!playerId || typeof playerId !== 'string') {
    throw new ApiError(400, 'INVALID_PLAYER_ID', 'playerId is required.');
  }
  if (!playerName || typeof playerName !== 'string') {
    throw new ApiError(400, 'INVALID_PLAYER_NAME', 'playerName is required.');
  }

  // Already waiting
  if (waiting.has(playerId)) {
    return { status: 'waiting' };
  }

  // Match with the oldest waiting player (FIFO-ish).
  const first = waiting.entries().next();
  if (!first.done) {
    const [otherId, other] = first.value;
    // Remove other from queue
    waiting.delete(otherId);

    // Create game: other becomes white, new player becomes black (simple deterministic).
    const created = await gameService.createGame({
      playerId: other.playerId,
      playerName: other.playerName,
      colorPreference: 'white',
    });

    const joined = await gameService.joinGame(created.game.id, {
      playerId,
      playerName,
      colorPreference: 'black',
    });

    return {
      status: 'matched',
      gameId: created.game.id,
      white: created.game.players.white,
      black: joined.game.players.black,
    };
  }

  waiting.set(playerId, { playerId, playerName, joinedAt: nowIso() });
  return { status: 'waiting' };
}

// PUBLIC_INTERFACE
async function leaveMatchmaking({ playerId }) {
  /** Leave matchmaking queue. */
  if (!playerId || typeof playerId !== 'string') {
    throw new ApiError(400, 'INVALID_PLAYER_ID', 'playerId is required.');
  }
  const existed = waiting.delete(playerId);
  return { status: existed ? 'left' : 'not_waiting' };
}

// PUBLIC_INTERFACE
async function getMatchmakingStatus(playerId) {
  /** Get matchmaking status for a playerId. */
  if (!playerId || typeof playerId !== 'string') {
    throw new ApiError(400, 'INVALID_PLAYER_ID', 'playerId is required.');
  }
  return { status: waiting.has(playerId) ? 'waiting' : 'not_waiting' };
}

module.exports = {
  joinMatchmaking,
  leaveMatchmaking,
  getMatchmakingStatus,
};
