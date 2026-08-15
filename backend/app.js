const express = require('express');
const http = require('./lib/http');
const { ApiError } = require('./lib/errors');
const recommendationsRouter = require('./routes/recommendations');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', offline: http.isOffline() }));
app.use('/api/v1/recommendations', recommendationsRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Typed errors carry their own status and body; anything else is a 500 without internals
app.use((err, req, res, next) => {
  if (err instanceof ApiError) return res.status(err.status).json(err.body);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request', details: ['body must be valid JSON'] });
  return res.status(500).json({ error: 'Internal error' });
});

module.exports = app;
