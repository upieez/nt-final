require('dotenv').config();
const app = require('./app');
const http = require('./lib/http');

if (!process.env.LASTFM_API_KEY && !http.isOffline()) {
  console.error('LASTFM_API_KEY is not set. Copy .env.example to .env and add your key, or run with NEXTTRACK_OFFLINE=1.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NextTrack listening on http://localhost:${PORT}`);
});
