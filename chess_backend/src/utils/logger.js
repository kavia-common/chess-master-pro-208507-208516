const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getLevel() {
  const raw = (process.env.REACT_APP_LOG_LEVEL || process.env.LOG_LEVEL || 'info').toLowerCase();
  return LEVELS[raw] ? raw : 'info';
}

const activeLevel = getLevel();

function shouldLog(level) {
  return LEVELS[level] >= LEVELS[activeLevel];
}

function serializeArgs(args) {
  return args.map((a) => {
    if (a instanceof Error) {
      return { name: a.name, message: a.message, stack: a.stack };
    }
    return a;
  });
}

const logger = {
  debug: (...args) => {
    if (shouldLog('debug')) console.log('[debug]', ...serializeArgs(args));
  },
  info: (...args) => {
    if (shouldLog('info')) console.log('[info]', ...serializeArgs(args));
  },
  warn: (...args) => {
    if (shouldLog('warn')) console.warn('[warn]', ...serializeArgs(args));
  },
  error: (...args) => {
    if (shouldLog('error')) console.error('[error]', ...serializeArgs(args));
  },
};

module.exports = { logger };
