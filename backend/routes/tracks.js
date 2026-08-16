const express = require('express');
const lastfm = require('../lib/lastfm');
const { validationError, upstreamError } = require('../lib/errors');

const router = express.Router();
const MAX_RESULTS = 8;

router.get('/search', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) throw validationError(['q must be a non-empty string']);
    const result = await lastfm.searchTracks(q, MAX_RESULTS);
    if (result.status === 'timeout' || result.status === 'error') throw upstreamError({ source: 'lastfm', status: result.status });
    res.json({ results: (result.results || []).slice(0, MAX_RESULTS) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
