const http = require('./http');
const lastfm = require('./lastfm');
const { resolveTrack } = require('./reconcile');
const { buildPool } = require('./candidates');
const { resolveSeeds, seedSummary } = require('./seeds');
const { topTagNames } = require('./explain');
const { diagnosticsFrom } = require('./recommend');
const { unresolvableError } = require('./errors');

const SUMMARIES = {
  random: 'Chosen uniformly at random from the same candidate pool, ignoring all metadata.',
  popular: 'The candidate with the most Last.fm listeners in the same pool, ignoring the seed sequence.'
};

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function withListeners(candidates) {
  const infos = await Promise.all(candidates.map((c) => lastfm.getTrackInfo(c.artist, c.title)));
  return candidates.map((c, i) => ({ ...c, listeners: infos[i].status === 'ok' ? infos[i].listeners : 0 }));
}

// Random ignores metadata entirely; popular ranks by listeners so ties fall to pool order
async function orderByStrategy(strategy, candidates) {
  if (strategy === 'random') return shuffle(candidates).map((c) => ({ ...c, listeners: null }));
  const enriched = await withListeners(candidates);
  return enriched.sort((a, b) => b.listeners - a.listeners);
}

async function describeWinner(winner, getArtist) {
  const track = await resolveTrack(winner);
  const artist = await getArtist(track.artistMbid);
  const tagResult = await lastfm.resolveTags(winner.artist, winner.title);
  return {
    artist: winner.artist,
    title: winner.title,
    mbid: track.mbid,
    wikidataId: artist.wikidataId || null,
    listeners: winner.listeners ?? track.listeners ?? null,
    tags: tagResult.status === 'ok' ? topTagNames(tagResult.tags) : []
  };
}

async function runBaseline({ sequence, strategy, options, preferences }, startedAt) {
  const { seeds, warnings, getArtist } = await resolveSeeds(sequence);
  const pool = await buildPool({ seeds: sequence, poolMode: options.poolMode, poolSize: options.poolSize, excludeArtists: preferences.excludeArtists });
  if (pool.fallbackReason) warnings.push({ track: '(pool)', issue: `fell back to the fixed candidate pool: ${pool.fallbackReason}` });
  const ordered = await orderByStrategy(strategy, pool.candidates);
  if (ordered.length === 0) throw unresolvableError('The candidate pool was empty after removing seeds and excluded artists.', warnings);
  const winner = ordered[0];
  return {
    strategy,
    recommendation: await describeWinner(winner, getArtist),
    score: null,
    explanation: { matchedTags: [], matchedGenres: [], sharedRelations: [], summary: SUMMARIES[strategy] },
    alternatives: ordered.slice(1, 1 + options.alternatives).map((c) => ({ artist: c.artist, title: c.title, score: null, matchedTags: [] })),
    candidatePool: { mode: pool.mode, size: pool.candidates.length, scored: pool.candidates.length, scoreless: 0, excluded: pool.excluded },
    seeds: seeds.map(seedSummary),
    warnings
  };
}

// Same seeds and candidate pool as the main pipeline, different selection rule
async function recommendBaseline(request) {
  const startedAt = Date.now();
  const { result, stats } = await http.withRequestStats(() => runBaseline(request, startedAt));
  return { ...result, diagnostics: diagnosticsFrom(stats, startedAt, 0) };
}

module.exports = { recommendBaseline };
