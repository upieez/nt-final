const express = require('express');
const path = require('path');
const fs = require('fs');
const { getTopTags, getTrackInfo } = require('../lib/lastfm');
const {
  STRICTNESS_THRESHOLD,
  buildSequenceTagSet,
  scoreCandidate,
  applyDiscoveryPenalty,
  rankCandidates
} = require('../lib/scoring');

const router = express.Router();
const CANDIDATES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'candidates.json'), 'utf8'));

const label = (t) => `${t.artist} - ${t.title}`;
const key = (t) => `${t.artist.toLowerCase()}|${t.title.toLowerCase()}`;

function clamp01(value, fallback) {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

router.post('/next-track', async (req, res) => {
  const { sequence, preferences } = req.body || {};

  if (!Array.isArray(sequence) || sequence.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty "sequence" array of { artist, title } objects.' });
  }
  for (const item of sequence) {
    if (!item || typeof item.artist !== 'string' || typeof item.title !== 'string') {
      return res.status(400).json({ error: 'Every sequence item must have string "artist" and "title" fields.' });
    }
  }

  const genreStrictness = clamp01(preferences?.genreStrictness, 0.5);
  const discoveryFactor = clamp01(preferences?.discoveryFactor, 0.5);

  const warnings = [];
  const resolvedSeeds = [];
  for (const seed of sequence) {
    const result = await getTopTags(seed.artist, seed.title);
    if (result.status === 'ok') {
      resolvedSeeds.push({ track: seed, tags: result.tags });
    } else {
      const issue = {
        'not-found': 'artist/track not found on Last.fm',
        timeout: 'Last.fm request timed out',
        'no-tags': 'no tags returned by Last.fm'
      }[result.status] || result.message || 'Last.fm lookup failed';
      warnings.push({ track: label(seed), issue });
    }
  }

  if (resolvedSeeds.length === 0) {
    return res.status(422).json({ error: 'None of the supplied seed tracks could be resolved to tags on Last.fm.', warnings });
  }

  const { sequenceTagWeights, mostRecentTags } = buildSequenceTagSet(resolvedSeeds);
  const seedKeys = new Set(sequence.map(key));
  const pool = CANDIDATES.filter((c) => !seedKeys.has(key(c)));

  const scored = [];
  let candidatesScoreless = 0;
  let candidatesExcluded = 0;
  for (const candidate of pool) {
    const tagResult = await getTopTags(candidate.artist, candidate.title);
    if (tagResult.status === 'no-tags') {
      candidatesScoreless += 1;
      continue;
    }
    if (tagResult.status !== 'ok') {
      candidatesExcluded += 1;
      console.warn(`[candidate excluded] ${label(candidate)} -> ${tagResult.status}`);
      continue;
    }
    const info = await getTrackInfo(candidate.artist, candidate.title);
    const listeners = info.status === 'ok' ? info.listeners : 0;
    const { rawScore, matchedTags, overlapsMostRecent } = scoreCandidate(tagResult.tags, sequenceTagWeights, mostRecentTags);
    scored.push({ candidate, rawScore, matchedTags, listeners, overlapsMostRecent });
  }

  let eligible = scored;
  if (genreStrictness >= STRICTNESS_THRESHOLD) {
    eligible = scored.filter((s) => s.overlapsMostRecent);
  }
  if (eligible.length === 0) {
    return res.status(422).json({
      error: genreStrictness >= STRICTNESS_THRESHOLD
        ? 'No candidate shared any tag with the most recent seed track at the requested genreStrictness.'
        : 'No candidate could be scored against the seed sequence.',
      candidatesConsidered: pool.length,
      candidatesScoreless,
      candidatesExcluded,
      warnings: warnings.length ? warnings : undefined
    });
  }

  const maxListeners = Math.max(...eligible.map((s) => s.listeners || 0), 0);
  for (const s of eligible) {
    const { adjustedScore, normalisedPopularity } = applyDiscoveryPenalty(s.rawScore, s.listeners, maxListeners, discoveryFactor);
    s.adjustedScore = adjustedScore;
    s.normalisedPopularity = normalisedPopularity;
  }

  const winner = rankCandidates(eligible)[0];
  const response = {
    recommendation: { artist: winner.candidate.artist, title: winner.candidate.title },
    score: Number(winner.adjustedScore.toFixed(4)),
    rawScore: Number(winner.rawScore.toFixed(4)),
    matchedTags: winner.matchedTags,
    recencyWeightApplied: resolvedSeeds.length > 1,
    candidatesConsidered: pool.length,
    candidatesScoreless,
    candidatesExcluded
  };
  if (warnings.length > 0) response.warnings = warnings;
  return res.json(response);
});

module.exports = router;
