const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const http = require('./lib/http');
const { ApiError } = require('./lib/errors');
const { requestLogger } = require('./lib/logger');
const recommendationsRouter = require('./routes/recommendations');
const tracksRouter = require('./routes/tracks');
const studyRouter = require('./routes/study');

const JSON_BODY_LIMIT = '32kb';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
if (process.env.NODE_ENV !== 'test') app.use(requestLogger);

app.get('/health', (req, res) => res.json({ status: 'ok', offline: http.isOffline() }));
app.use('/api/v1/recommendations', recommendationsRouter);
app.use('/api/v1/tracks', tracksRouter);
app.use('/api/v1/study', studyRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Typed errors carry their own status and body; anything else is a 500 without internals
app.use((err, req, res, next) => {
  if (err instanceof ApiError) return res.status(err.status).json(err.body);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request', details: ['body must be valid JSON'] });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  return res.status(500).json({ error: 'Internal error' });
});

module.exports = app;
