const express = require('express');
const { validateRecommendationRequest } = require('../lib/validate');
const { createTrial, recordRatings } = require('../lib/study');

const router = express.Router();

router.post('/compare', async (req, res, next) => {
  try {
    res.json(await createTrial(validateRecommendationRequest(req.body)));
  } catch (err) {
    next(err);
  }
});

router.post('/rate', (req, res, next) => {
  try {
    res.json(recordRatings(req.body || {}));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
