/* Central configuration from environment variables (see .env.example). */
'use strict';

function str(name, def) { const v = process.env[name]; return v === undefined || v === '' ? def : v; }
function int(name, def, min, max) {
  const v = parseInt(str(name, ''), 10);
  if (Number.isNaN(v)) return def;
  return Math.min(max, Math.max(min, v));
}
function bool(name, def) {
  const v = str(name, '');
  if (v === '') return def;
  return /^(1|true|yes|on)$/i.test(v);
}

const production = str('NODE_ENV', 'production') === 'production';

const config = {
  version: require('../package.json').version,
  production,
  port: int('APP_PORT_INTERNAL', 8080, 1, 65535),
  timezone: str('TZ', 'Europe/Berlin'),
  appSecret: str('APP_SECRET', ''),
  db: {
    host: str('DB_HOST', 'db'),
    port: int('DB_PORT', 5432, 1, 65535),
    database: str('POSTGRES_DB', 'jarbou_recruiting'),
    user: str('POSTGRES_USER', 'jarbou'),
    password: str('POSTGRES_PASSWORD', '')
  },
  // Cookies: "auto" = Secure when the request arrived over HTTPS (directly or via a trusted proxy).
  cookieSecure: str('COOKIE_SECURE', 'auto'),
  trustProxy: bool('TRUST_PROXY', false),
  session: {
    idleMinutes: int('SESSION_IDLE_MINUTES', 480, 5, 60 * 24 * 7),
    rememberDays: int('SESSION_REMEMBER_DAYS', 14, 1, 90),
    maxHours: int('SESSION_MAX_HOURS', 12, 1, 72)
  },
  initialAdmin: {
    username: str('INITIAL_ADMIN_USERNAME', ''),
    email: str('INITIAL_ADMIN_EMAIL', ''),
    fullName: str('INITIAL_ADMIN_FULL_NAME', 'Administrator'),
    password: str('INITIAL_ADMIN_PASSWORD', '')
  },
  paths: {
    frontend: str('FRONTEND_DIR', require('path').resolve(__dirname, '../../frontend')),
    migrations: str('MIGRATIONS_DIR', require('path').resolve(__dirname, '../../database/migrations')),
    uploads: str('UPLOAD_DIR', '/data/uploads'),
    backups: str('BACKUP_DIR', '/backups')
  },
  uploads: {
    enabled: bool('UPLOADS_ENABLED', true),
    maxMb: int('UPLOAD_MAX_MB', 15, 1, 100)
  },
  backup: {
    enabled: bool('BACKUP_ENABLED', true),
    time: str('BACKUP_TIME', '02:30'),
    keepDaily: int('BACKUP_KEEP_DAILY', 7, 1, 365),
    keepWeekly: int('BACKUP_KEEP_WEEKLY', 4, 0, 260),
    keepMonthly: int('BACKUP_KEEP_MONTHLY', 3, 0, 120)
  },
  passwordMinLength: int('PASSWORD_MIN_LENGTH', 10, 8, 128)
};

module.exports = config;
