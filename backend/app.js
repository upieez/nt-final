const express = require('express');
const http = require('./lib/http');
const recommendationsRouter = require('./routes/recommendations');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', offline: http.isOffline() }));
app.use('/api/v1/recommendations', recommendationsRouter);

module.exports = app;
