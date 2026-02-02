const { Chess } = require('chess.js');
const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('../utils/apiError');
const { saveGameSnapshot, loadGameSnapshot } = require('./persistence');

const games = new Map();
/** @type {Map<string, Promise<any>>} */
const gameLocks = new Map();

function nowIso() {
  return new Date().toISOString();
}

function normalizeColorPreference(colorPreference) {
  if (!colorPreference) return 'random';
  const v = String(colorPreference).toLowerCase();
  if (v === 'white' || v === 'black' || v === 'random') return v;
  throw new ApiError(400, 'INVALID_COLOR_PREFERENCE', 'colorPreference must be one of: white, black, random.');
}

function computeStatus(chess) {
  const isCheck = chess.isCheck();
  const isCheckmate = chess.isCheckmate();
  const isStalemate = chess.isStalemate();

  // chess.js "draw" includes: stalemate, threefold repetition, insufficient material, 50-move rule.
  const isDraw = chess.isDraw();
  const isGameOver = chess.isGameOver();

  let result = null;
  if (isCheckmate) {
    // If it's checkmate, side to move is checkmated. Winner is the other side.
    result = chess.turn() === 'w' ? 'black' : 'white';
  } else if (isDraw) {
    result = 'draw';
  }

  return {
    turn: chess.turn() === 'w' ? 'white' : 'black',
    isCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    isGameOver,
    result,
  };
}

function snapshotFromGame(game) {
  const chess = game.chess;
  return {
    id: game.id,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    players: game.players,
    fen: chess.fen(),
    pgn: chess.pgn(),
    history: chess.history({ verbose: true }),
    status: computeStatus(chess),
  };
}

function loadGameIntoMemory(snapshot) {
  const chess = new Chess();
  try {
    // Prefer restoring via FEN; history is derivable from PGN, but FEN is simplest.
    chess.load(snapshot.fen);
  } catch (err) {
    throw new ApiError(500, 'GAME_SNAPSHOT_INVALID', 'Saved game snapshot is corrupted and cannot be loaded.');
  }

  const game = {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    players: snapshot.players || { white: null, black: null },
    chess,
  };
  games.set(game.id, game);
  return game;
}

// PUBLIC_INTERFACE
async function serializeGameOp(gameId, op) {
  /** Serialize operations per-game to avoid races between REST and WS moves. */
  const prev = gameLocks.get(gameId) || Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(op)
    .finally(() => {
      if (gameLocks.get(gameId) === next) gameLocks.delete(gameId);
    });
  gameLocks.set(gameId, next);
  return next;
}

function assignColor(players, requested) {
  const pref = normalizeColorPreference(requested);
  if (pref === 'white') {
    if (players.white) throw new ApiError(409, 'COLOR_TAKEN', 'White seat already taken.');
    return 'white';
  }
  if (pref === 'black') {
    if (players.black) throw new ApiError(409, 'COLOR_TAKEN', 'Black seat already taken.');
    return 'black';
  }

  // random
  if (!players.white) return 'white';
  if (!players.black) return 'black';
  throw new ApiError(409, 'GAME_FULL', 'Game already has two players.');
}

function validatePlayerPayload(playerId, playerName) {
  if (!playerId || typeof playerId !== 'string' || playerId.length < 3) {
    throw new ApiError(400, 'INVALID_PLAYER_ID', 'playerId is required and must be a string (min length 3).');
  }
  if (!playerName || typeof playerName !== 'string' || playerName.trim().length < 1) {
    throw new ApiError(400, 'INVALID_PLAYER_NAME', 'playerName is required.');
  }
}

function requireGame(gameId) {
  const g = games.get(gameId);
  if (!g) throw new ApiError(404, 'GAME_NOT_FOUND', `Game ${gameId} was not found.`);
  return g;
}

// PUBLIC_INTERFACE
async function getOrLoadGame(gameId) {
  /** Get game from memory or load it from disk if available. */
  const inMem = games.get(gameId);
  if (inMem) return inMem;

  const snap = await loadGameSnapshot(gameId);
  if (!snap) throw new ApiError(404, 'GAME_NOT_FOUND', `Game ${gameId} was not found.`);
  return loadGameIntoMemory(snap);
}

// PUBLIC_INTERFACE
async function createGame({ playerId, playerName, colorPreference }) {
  /** Create a new game and seat the creating player. */
  validatePlayerPayload(playerId, playerName);

  const id = uuidv4().replace(/-/g, '').slice(0, 12);
  const chess = new Chess();

  const players = { white: null, black: null };
  const color = assignColor(players, colorPreference);
  players[color] = { id: playerId, name: playerName };

  const game = {
    id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    players,
    chess,
  };
  games.set(id, game);

  // Save initial snapshot.
  await saveGameSnapshot(snapshotFromGame(game));

  return { game: snapshotFromGame(game), yourColor: color };
}

// PUBLIC_INTERFACE
async function joinGame(gameId, { playerId, playerName, colorPreference }) {
  /** Join an existing game, seating player into available color slot. */
  validatePlayerPayload(playerId, playerName);

  return serializeGameOp(gameId, async () => {
    const game = await getOrLoadGame(gameId);

    // Re-join behavior: if player already seated, return their color.
    if (game.players.white && game.players.white.id === playerId) {
      return { game: snapshotFromGame(game), yourColor: 'white' };
    }
    if (game.players.black && game.players.black.id === playerId) {
      return { game: snapshotFromGame(game), yourColor: 'black' };
    }

    const color = assignColor(game.players, colorPreference);
    game.players[color] = { id: playerId, name: playerName };
    game.updatedAt = nowIso();

    await saveGameSnapshot(snapshotFromGame(game));
    return { game: snapshotFromGame(game), yourColor: color };
  });
}

function ensurePlayerTurn(game, playerId) {
  const turn = game.chess.turn() === 'w' ? 'white' : 'black';
  const seat = game.players[turn];
  if (!seat) {
    throw new ApiError(409, 'TURN_UNSEATED', `It is ${turn}'s turn, but that seat is not occupied.`);
  }
  if (seat.id !== playerId) {
    throw new ApiError(403, 'NOT_YOUR_TURN', `It is ${turn}'s turn.`);
  }
}

function ensureGameNotOver(game) {
  if (game.chess.isGameOver()) {
    throw new ApiError(409, 'GAME_OVER', 'Game is already over.');
  }
}

// PUBLIC_INTERFACE
async function applyMove(gameId, { playerId, from, to, promotion }) {
  /** Apply a move server-side (authoritative), validating turn + legality. */
  if (!from || !to) {
    throw new ApiError(400, 'INVALID_MOVE', 'Move requires "from" and "to" coordinates.');
  }
  if (promotion && !/^[qrbn]$/.test(String(promotion))) {
    throw new ApiError(400, 'INVALID_PROMOTION', 'promotion must be one of: q, r, b, n.');
  }

  return serializeGameOp(gameId, async () => {
    const game = await getOrLoadGame(gameId);

    ensureGameNotOver(game);
    ensurePlayerTurn(game, playerId);

    // chess.js validates: castling, en passant, promotion, checks, etc.
    const move = game.chess.move({
      from: String(from),
      to: String(to),
      promotion: promotion ? String(promotion) : undefined,
    });

    if (!move) {
      throw new ApiError(400, 'ILLEGAL_MOVE', 'Illegal move for current position.');
    }

    game.updatedAt = nowIso();
    const snap = snapshotFromGame(game);
    await saveGameSnapshot(snap);

    return { game: snap, move };
  });
}

// PUBLIC_INTERFACE
async function getGameSnapshot(gameId) {
  /** Return a safe snapshot of the current game state. */
  const game = await getOrLoadGame(gameId);
  return snapshotFromGame(game);
}

// PUBLIC_INTERFACE
async function saveGame(gameId) {
  /** Force-save a game snapshot to disk. */
  const game = await getOrLoadGame(gameId);
  await saveGameSnapshot(snapshotFromGame(game));
  return snapshotFromGame(game);
}

module.exports = {
  createGame,
  joinGame,
  applyMove,
  getGameSnapshot,
  getOrLoadGame,
  saveGame,
  serializeGameOp,
};
