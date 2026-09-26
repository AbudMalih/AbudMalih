/* Minimal structured logger. Never pass passwords, hashes, tokens or document contents here. */
'use strict';

function write(level, msg, meta) {
  const line = { time: new Date().toISOString(), level, msg };
  if (meta) Object.assign(line, meta);
  const out = JSON.stringify(line);
  if (level === 'error' || level === 'warn') console.error(out); else console.log(out);
}

module.exports = {
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta)
};
