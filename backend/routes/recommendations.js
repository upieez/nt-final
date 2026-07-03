const express = require('express');
const path = require('path');
const fs = require('fs');
const { resolveTags, getTrackInfo } = require('../lib/lastfm');
const {
  STRICTNESS_THRESHOLD,
  ARTIST_TAG_CONFIDENCE,
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
  const seedTagSources = [];
  let seedsUsingArtistTags = 0;
  for (const seed of sequence) {
    const result = await resolveTags(seed.artist, seed.title);
    if (result.status === 'ok') {
      const usedFallback = result.tagSource === 'artist';
      if (usedFallback) {
        seedsUsingArtistTags += 1;
        warnings.push({ track: label(seed), issue: `track-level tags unavailable (${result.fallbackReason}); used artist-level tags at ${ARTIST_TAG_CONFIDENCE} confidence` });
      }
      resolvedSeeds.push({ track: seed, tags: result.tags, confidence: usedFallback ? ARTIST_TAG_CONFIDENCE : 1 });
      seedTagSources.push({ track: label(seed), tagSource: result.tagSource });
    } else {
      const issue = {
        'not-found': 'artist/track not found on Last.fm',
        timeout: 'Last.fm request timed out',
        'no-tags': 'no tags at track or artist level on Last.fm'
      }[result.status] || result.message || 'Last.fm lookup failed';
      warnings.push({ track: label(seed), issue });
      seedTagSources.push({ track: label(seed), tagSource: null });
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
  let candidatesUsingArtistTags = 0;
  for (const candidate of pool) {
    const tagResult = await resolveTags(candidate.artist, candidate.title);
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
    const usedFallback = tagResult.tagSource === 'artist';
    if (usedFallback) candidatesUsingArtistTags += 1;
    const { rawScore, matchedTags, overlapsMostRecent } = scoreCandidate(
      tagResult.tags, sequenceTagWeights, mostRecentTags, usedFallback ? ARTIST_TAG_CONFIDENCE : 1
    );
    scored.push({ candidate, rawScore, matchedTags, listeners, overlapsMostRecent, tagSource: tagResult.tagSource });
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
      candidatesUsingArtistTags,
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
    winnerTagSource: winner.tagSource,
    seedTagSources,
    seedsUsingArtistTags,
    candidatesUsingArtistTags,
    recencyWeightApplied: resolvedSeeds.length > 1,
    candidatesConsidered: pool.length,
    candidatesScoreless,
    candidatesExcluded
  };
  if (warnings.length > 0) response.warnings = warnings;
  return res.json(response);
});

module.exports = router;
