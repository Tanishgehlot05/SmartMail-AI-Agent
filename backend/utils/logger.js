const PREFIXES = {
  gmail: '[GMAIL]',
  pubsub: '[PUBSUB]',
  gemini: '[GEMINI]',
  telegram: '[TELEGRAM]',
  database: '[DATABASE]',
  pipeline: '[PIPELINE]',
  notify: '[NOTIFY]',
  startup: '[STARTUP]',
  health: '[HEALTH]',
  debug: '[DEBUG]',
  cron: '[CRON]',
  webhook: '[WEBHOOK]',
};

function formatMessage(prefix, message) {
  return `${prefix} ${message}`;
}

function log(prefix, message, ...args) {
  console.log(formatMessage(prefix, message), ...args);
}

function warn(prefix, message, ...args) {
  console.warn(formatMessage(prefix, message), ...args);
}

function error(prefix, message, ...args) {
  console.error(formatMessage(prefix, message), ...args);
}

export function createLogger(tag) {
  const prefix = PREFIXES[tag] || `[${String(tag).toUpperCase()}]`;
  return {
    info: (message, ...args) => log(prefix, message, ...args),
    warn: (message, ...args) => warn(prefix, message, ...args),
    error: (message, ...args) => error(prefix, message, ...args),
    ok: (message) => log(prefix, `✓ ${message}`),
    fail: (message) => error(prefix, `✗ ${message}`),
  };
}

export default { createLogger, PREFIXES };
