const express = require('express');
const { validateRecommendationRequest, validateBaselineRequest } = require('../lib/validate');
const { recommend } = require('../lib/recommend');
const { recommendBaseline } = require('../lib/baseline');

const router = express.Router();

router.post('/next-track', async (req, res, next) => {
  try {
    res.json(await recommend(validateRecommendationRequest(req.body)));
  } catch (err) {
    next(err);
  }
});

router.post('/baseline', async (req, res, next) => {
  try {
    res.json(await recommendBaseline(validateBaselineRequest(req.body)));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
