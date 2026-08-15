const express = require('express');
const { validateRecommendationRequest } = require('../lib/validate');
const { recommend } = require('../lib/recommend');

const router = express.Router();

router.post('/next-track', async (req, res, next) => {
  try {
    res.json(await recommend(validateRecommendationRequest(req.body)));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
