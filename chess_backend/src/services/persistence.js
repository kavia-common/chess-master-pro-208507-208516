const fs = require('fs/promises');
const path = require('path');
const { ApiError } = require('../utils/apiError');

const DATA_DIR = process.env.GAMES_DATA_DIR || path.join(process.cwd(), 'data');
const GAMES_DIR = path.join(DATA_DIR, 'games');

async function ensureDirs() {
  await fs.mkdir(GAMES_DIR, { recursive: true });
}

function safeGameId(gameId) {
  if (!/^[a-zA-Z0-9_-]{6,128}$/.test(gameId)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid gameId format.');
  }
  return gameId;
}

function gameFilePath(gameId) {
  return path.join(GAMES_DIR, `${safeGameId(gameId)}.json`);
}

// PUBLIC_INTERFACE
async function saveGameSnapshot(gameSnapshot) {
  /** Persist a game snapshot to disk (atomic-ish write). */
  if (!gameSnapshot || !gameSnapshot.id) {
    throw new ApiError(500, 'PERSISTENCE_INVALID_SNAPSHOT', 'Cannot persist empty game snapshot.');
  }
  await ensureDirs();

  const tmpPath = gameFilePath(gameSnapshot.id) + `.tmp-${Date.now()}`;
  const finalPath = gameFilePath(gameSnapshot.id);

  const payload = JSON.stringify(gameSnapshot, null, 2);
  await fs.writeFile(tmpPath, payload, 'utf8');
  await fs.rename(tmpPath, finalPath);
}

// PUBLIC_INTERFACE
async function loadGameSnapshot(gameId) {
  /** Load a game snapshot from disk. Returns null if not found. */
  await ensureDirs();
  const fp = gameFilePath(gameId);
  try {
    const raw = await fs.readFile(fp, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw new ApiError(500, 'PERSISTENCE_READ_FAILED', 'Failed to read saved game.', { error: String(err) });
  }
}

// PUBLIC_INTERFACE
async function listSavedGames() {
  /** List saved games from disk (IDs only). */
  await ensureDirs();
  const entries = await fs.readdir(GAMES_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => e.name.replace(/\.json$/, ''));
}

module.exports = {
  saveGameSnapshot,
  loadGameSnapshot,
  listSavedGames,
};
