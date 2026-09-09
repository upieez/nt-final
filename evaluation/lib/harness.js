const lastfm = require('../../backend/lib/lastfm');
const { recommend } = require('../../backend/lib/recommend');
const { recommendBaseline } = require('../../backend/lib/baseline');
const { buildPool } = require('../../backend/lib/candidates');
const { resolveTrack, resolveArtist, trackKey } = require('../../backend/lib/reconcile');
const { validateRecommendationRequest, validateBaselineRequest } = require('../../backend/lib/validate');
const m = require('./metrics');

const SYSTEMS = ['nexttrack', 'random', 'popular'];
const RANDOM_DRAWS = 20;
const RANDOM_SEED = 20260905;
const DEFAULT_PREFERENCES = { genreStrictness: 0.5, discoveryFactor: 0.5, divergence: 0 };
// Each parameter moves from low to high with the others at their defaults
const SENSITIVITY = [
  { parameter: 'discoveryFactor', low: 0, high: 1 },
  { parameter: 'genreStrictness', low: 0, high: 1 },
  { parameter: 'divergence', low: 0, high: 1 }
];

// Tags, genres and listeners for one track; seeds get the full recording lookup like the pipeline does
function trackDescriber() {
  const memo = new Map();
  return async (artist, title, { full = false } = {}) => {
    const key = trackKey(artist, title);
    if (memo.has(key)) return memo.get(key);
    const tagResult = await lastfm.resolveTags(artist, title);
    const track = await resolveTrack({ artist, title }, { full });
    const entity = await resolveArtist(track.artistMbid);
    const described = {
      artist,
      title,
      key,
      mbid: track.mbid,
      tags: tagResult.status === 'ok' ? tagResult.tags : [],
      tagSource: tagResult.status === 'ok' ? tagResult.tagSource : null,
      genres: [...new Set([...track.recordingGenres, ...entity.genres])],
      listeners: track.listeners
    };
    memo.set(key, described);
    return described;
  };
}

function errorInfo(err) {
  return { status: err.status || 500, message: err.message };
}

async function attempt(fn) {
  try {
    return { ok: true, body: await fn() };
  } catch (err) {
    return { ok: false, error: errorInfo(err) };
  }
}

// Winner metrics against the most recent seed; genre continuation is split into tag-or-genre and genre-only
async function measureWinner(body, reference, poolListeners, describe) {
  const winner = await describe(body.recommendation.artist, body.recommendation.title);
  return {
    winner: { artist: winner.artist, title: winner.title, mbid: winner.mbid, listeners: winner.listeners },
    tagCoherence: m.round(m.tagCoherence(winner.tags, reference.tags)),
    genreContinuation: m.sharesAny(winner.genres, reference.genres) || m.sharesAny(winner.tags.map((t) => t.name), reference.tags.map((t) => t.name)),
    mbGenreContinuation: reference.genres.length > 0 ? m.sharesAny(winner.genres, reference.genres) : null,
    popularityPercentile: m.round(m.popularityPercentile(winner.listeners, poolListeners)),
    latencyMs: body.diagnostics.latencyMs,
    matchRate: body.diagnostics.matchRate,
    pool: body.candidatePool,
    warnings: body.warnings.length
  };
}

function nexttrackRequest(sequence, preferences) {
  return validateRecommendationRequest({ sequence, preferences: { ...DEFAULT_PREFERENCES, ...preferences } });
}

async function runNexttrack(sequence, preferences, reference, poolListeners, describe) {
  const run = await attempt(() => recommend(nexttrackRequest(sequence, preferences)));
  if (!run.ok) return run;
  return { ok: true, ...(await measureWinner(run.body, reference, poolListeners, describe)), score: run.body.score, seeds: run.body.seeds };
}

async function runPopular(sequence, reference, poolListeners, describe) {
  const run = await attempt(() => recommendBaseline(validateBaselineRequest({ sequence, strategy: 'popular' })));
  if (!run.ok) return run;
  return { ok: true, ...(await measureWinner(run.body, reference, poolListeners, describe)) };
}

// baseline.js draws with Math.random, so the draw is made reproducible by swapping in a seeded PRNG
async function withSeededRandom(random, fn) {
  const original = Math.random;
  Math.random = random;
  try {
    return await fn();
  } finally {
    Math.random = original;
  }
}

function meanOfRuns(runs, field) {
  return m.round(m.mean(runs.map((r) => (typeof r[field] === 'boolean' ? Number(r[field]) : r[field]))));
}

// Random is the mean over RANDOM_DRAWS seeded draws; each draw is a full baseline call over the same pool
async function runRandom(sequence, reference, poolListeners, describe, random) {
  const draws = [];
  for (let i = 0; i < RANDOM_DRAWS; i += 1) {
    const run = await withSeededRandom(random, () => attempt(() => recommendBaseline(validateBaselineRequest({ sequence, strategy: 'random' }))));
    if (!run.ok) return run;
    draws.push(await measureWinner(run.body, reference, poolListeners, describe));
  }
  return {
    ok: true,
    draws: draws.length,
    winners: [...new Set(draws.map((d) => `${d.winner.artist} - ${d.winner.title}`))].length,
    tagCoherence: meanOfRuns(draws, 'tagCoherence'),
    genreContinuation: meanOfRuns(draws, 'genreContinuation'),
    mbGenreContinuation: meanOfRuns(draws, 'mbGenreContinuation'),
    popularityPercentile: meanOfRuns(draws, 'popularityPercentile'),
    latencyMs: m.percentile(draws.map((d) => d.latencyMs), 0.5),
    matchRate: draws[0].matchRate,
    pool: draws[0].pool
  };
}

function winnerKey(run) {
  return run.ok ? trackKey(run.winner.artist, run.winner.title) : null;
}

function sensitivityPoint(run) {
  if (!run.ok) return null;
  return { winner: run.winner, tagCoherence: run.tagCoherence, popularityPercentile: run.popularityPercentile, contrast: run.pool.contrast };
}

async function runSensitivity(sequence, reference, poolListeners, describe) {
  const results = {};
  for (const { parameter, low, high } of SENSITIVITY) {
    const lowRun = await runNexttrack(sequence, { [parameter]: low }, reference, poolListeners, describe);
    const highRun = await runNexttrack(sequence, { [parameter]: high }, reference, poolListeners, describe);
    const both = lowRun.ok && highRun.ok;
    results[parameter] = {
      ok: both,
      changed: both ? winnerKey(lowRun) !== winnerKey(highRun) : null,
      low: sensitivityPoint(lowRun),
      high: sensitivityPoint(highRun),
      error: both ? null : (lowRun.error || highRun.error)
    };
  }
  return results;
}

// The same default pool every system draws from, with listeners for the popularity percentile
async function poolListenersFor(sequence) {
  const pool = await buildPool({ seeds: sequence, poolMode: 'dynamic', poolSize: 40, excludeArtists: [] });
  const infos = await Promise.all(pool.candidates.map((c) => lastfm.getTrackInfo(c.artist, c.title)));
  return infos.map((info) => (info.status === 'ok' ? info.listeners : null));
}

async function runSequence(entry, random) {
  const describe = trackDescriber();
  const mostRecent = entry.sequence[entry.sequence.length - 1];
  const reference = await describe(mostRecent.artist, mostRecent.title, { full: true });
  const poolListeners = await poolListenersFor(entry.sequence);
  const systems = {
    nexttrack: await runNexttrack(entry.sequence, {}, reference, poolListeners, describe),
    random: await runRandom(entry.sequence, reference, poolListeners, describe, random),
    popular: await runPopular(entry.sequence, reference, poolListeners, describe)
  };
  return {
    id: entry.id,
    group: entry.group,
    sequence: entry.sequence,
    reference: { tags: reference.tags.length, tagSource: reference.tagSource, genres: reference.genres.length, mbid: reference.mbid },
    systems,
    sensitivity: await runSensitivity(entry.sequence, reference, poolListeners, describe)
  };
}

// Runs every sequence in order; a failed run is recorded with its error and never counted as a result
async function runHarness(sequences, { onProgress = () => {} } = {}) {
  const random = m.mulberry32(RANDOM_SEED);
  const results = [];
  for (const entry of sequences) {
    results.push(await runSequence(entry, random));
    onProgress(results[results.length - 1]);
  }
  return results;
}

module.exports = { runHarness, SYSTEMS, SENSITIVITY, RANDOM_DRAWS, RANDOM_SEED, DEFAULT_PREFERENCES };
