require('dotenv').config();
const express = require('express');
const recommendationsRouter = require('./routes/recommendations');

if (!process.env.LASTFM_API_KEY) {
  console.error('LASTFM_API_KEY is not set. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/v1/recommendations', recommendationsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NextTrack listening on http://localhost:${PORT}`);
});

module.exports = app;
