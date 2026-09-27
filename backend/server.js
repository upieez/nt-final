require('dotenv').config();
const app = require('./app');
const http = require('./lib/http');

const SHUTDOWN_GRACE_MS = 10000;

if (!process.env.LASTFM_API_KEY && !http.isOffline()) {
  console.error('LASTFM_API_KEY is not set. Copy .env.example to .env and add your key, or run with NEXTTRACK_OFFLINE=1.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`NextTrack listening on http://localhost:${PORT}${http.isOffline() ? ' (offline mode)' : ''}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    http.flushCache();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
