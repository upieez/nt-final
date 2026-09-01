const http = require('./http');
const lastfm = require('./lastfm');
const scoring = require('./scoring');
const { resolveTrack, matchRate } = require('./reconcile');
const { buildPool } = require('./candidates');
const { resolveSeeds, seedSummary, failureError } = require('./seeds');
const { buildSummary, topTagNames } = require('./explain');
const { unresolvableError } = require('./errors');

const DEFAULT_ENRICH_BUDGET_MS = 25000;

function enrichBudgetMs() {
  const value = Number(process.env.NEXTTRACK_ENRICH_BUDGET_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_ENRICH_BUDGET_MS;
}

function round(value) {
  return Number((value || 0).toFixed(4));
}

// Tags for every candidate in parallel; the rate limiter spaces the Last.fm calls
async function fetchCandidateTags(candidates) {
  return Promise.all(candidates.map((c) => lastfm.resolveTags(c.artist, c.title)));
}

// Canonical ids and artist entities sequentially, skipped once the enrichment budget is spent
async function enrichCandidates(candidates, getArtist, startedAt) {
  const enriched = [];
  let skipped = 0;
  for (const candidate of candidates) {
    if (Date.now() - startedAt > enrichBudgetMs()) {
      skipped += 1;
      enriched.push({ track: null, artist: await getArtist(null) });
      continue;
    }
    const track = await resolveTrack(candidate);
    enriched.push({ track, artist: await getArtist(track.artistMbid) });
  }
  return { enriched, skipped };
}

function classify(tagResult, genres) {
  if (tagResult.status === 'ok') return 'scored';
  if (genres.length > 0) return 'scored';
  return tagResult.status === 'no-tags' ? 'scoreless' : 'excluded';
}

function scoreOne(candidate, tagResult, entity, context) {
  const tags = tagResult.status === 'ok' ? tagResult.tags : [];
  const confidence = tagResult.tagSource === 'artist' ? scoring.ARTIST_TAG_CONFIDENCE : 1;
  const genres = [...new Set([...(entity.track?.recordingGenres || []), ...entity.artist.genres])];
  const tag = scoring.scoreCandidate(tags, context.sequenceTagWeights, context.mostRecentTags, confidence);
  const genre = scoring.scoreGenres(genres, context.sequenceGenreWeights, context.mostRecentGenres);
  const graph = scoring.scoreGraph(entity.artist, context.seedArtists);
  return {
    candidate,
    tags,
    genres,
    track: entity.track,
    artist: entity.artist,
    listeners: entity.track?.listeners ?? null,
    tagOverlap: tag.tagOverlap,
    genreOverlap: genre.genreOverlap,
    graphSignal: graph.graphSignal,
    matchedTags: tag.matchedTags,
    matchedGenres: genre.matchedGenres,
    sharedRelations: graph.sharedRelations,
    overlapsMostRecent: tag.overlapsMostRecent || genre.overlapsMostRecent,
    rawScore: scoring.combineSignals({ tagOverlap: tag.tagOverlap, genreOverlap: genre.genreOverlap, graphSignal: graph.graphSignal })
  };
}

// At high divergence strictness is ignored entirely; targetGenre still applies
function passesFilters(scored, preferences) {
  if (!scoring.matchesTargetGenre(preferences.targetGenre, scored.tags, scored.genres)) return false;
  if (scoring.highDivergence(preferences.divergence)) return true;
  if (preferences.genreStrictness >= scoring.STRICTNESS_THRESHOLD && !scored.overlapsMostRecent) return false;
  return true;
}

function noEligibleMessage(preferences) {
  if (preferences.targetGenre) return `No candidate carried the target genre "${preferences.targetGenre}".`;
  if (preferences.genreStrictness >= scoring.STRICTNESS_THRESHOLD) return 'No candidate shared any tag or genre with the most recent seed track at the requested genreStrictness.';
  return 'No candidate could be scored against the seed sequence.';
}

function applyPenalties(eligible, preferences) {
  const maxListeners = Math.max(0, ...eligible.map((s) => s.listeners || 0));
  for (const s of eligible) {
    const diverged = scoring.applyDivergence(s.rawScore, preferences.divergence);
    const penalised = scoring.applyDiscoveryPenalty(diverged, s.listeners, maxListeners, preferences.discoveryFactor);
    s.popularityPenalty = penalised.popularityPenalty;
    const strictness = scoring.highDivergence(preferences.divergence) ? 0 : preferences.genreStrictness;
    s.adjustedScore = scoring.applyStrictness(penalised.adjustedScore, s.overlapsMostRecent, strictness);
  }
  return scoring.rankCandidates(eligible);
}

function sequenceTagNames(seeds) {
  return seeds.flatMap((s) => s.tags.map((t) => t.name));
}

function buildContext(seeds) {
  const usable = seeds.filter((s) => s.usable);
  return {
    ...scoring.buildSequenceTagSet(usable),
    ...scoring.buildSequenceGenreSet(usable),
    seedArtists: usable.map((s) => s.artist)
  };
}

function alternativesFrom(ranked, count) {
  return ranked.slice(1, 1 + count).map((s) => ({ artist: s.candidate.artist, title: s.candidate.title, score: round(s.adjustedScore), matchedTags: s.matchedTags }));
}

function recommendationFrom(winner) {
  return {
    artist: winner.candidate.artist,
    title: winner.candidate.title,
    mbid: winner.track?.mbid || null,
    wikidataId: winner.artist.wikidataId || null,
    listeners: winner.listeners,
    tags: topTagNames(winner.tags)
  };
}

function diagnosticsFrom(stats, startedAt, skipped) {
  return {
    latencyMs: Date.now() - startedAt,
    cacheHits: stats.cacheHits,
    cacheMisses: stats.cacheMisses,
    upstreamCalls: stats.upstreamCalls,
    matchRate: matchRate(stats),
    enrichmentSkipped: skipped
  };
}

async function scorePool({ seeds, getArtist, preferences, pool, startedAt, warnings }) {
  const tagResults = await fetchCandidateTags(pool.candidates);
  const { enriched, skipped } = await enrichCandidates(pool.candidates, getArtist, startedAt);
  if (skipped) warnings.push({ track: '(candidates)', issue: `${skipped} candidates scored on tags only because the enrichment time budget was exhausted` });
  const context = buildContext(seeds);
  const counts = { scored: 0, scoreless: 0, excluded: pool.excluded };
  const eligible = [];
  pool.candidates.forEach((candidate, i) => {
    const genres = [...(enriched[i].track?.recordingGenres || []), ...enriched[i].artist.genres];
    const kind = classify(tagResults[i], genres);
    if (kind !== 'scored') {
      counts[kind] += 1;
      return;
    }
    const scored = scoreOne(candidate, tagResults[i], enriched[i], context);
    if (!passesFilters(scored, preferences)) {
      counts.excluded += 1;
      return;
    }
    counts.scored += 1;
    eligible.push(scored);
  });
  return { ranked: applyPenalties(eligible, preferences), counts, skipped };
}

async function runPipeline({ sequence, preferences, options }, startedAt) {
  const { seeds, warnings, getArtist } = await resolveSeeds(sequence);
  const pool = await buildPool({ seeds: sequence, poolMode: options.poolMode, poolSize: options.poolSize, excludeArtists: preferences.excludeArtists, divergence: preferences.divergence, sequenceTags: sequenceTagNames(seeds) });
  if (pool.fallbackReason) warnings.push({ track: '(pool)', issue: `fell back to the fixed candidate pool: ${pool.fallbackReason}` });
  if (scoring.highDivergence(preferences.divergence) && preferences.genreStrictness > 0) {
    warnings.push({ track: '(preferences)', issue: `genreStrictness ${preferences.genreStrictness} ignored because divergence ${preferences.divergence} asks for something different` });
  }
  const { ranked, counts, skipped } = await scorePool({ seeds, getArtist, preferences, pool, startedAt, warnings });
  if (ranked.length === 0) {
    const upstream = failureError(pool.failures);
    if (upstream && counts.scored + counts.scoreless === 0) throw upstream;
    throw unresolvableError(noEligibleMessage(preferences), warnings);
  }
  const winner = ranked[0];
  const mostRecent = seeds[seeds.length - 1];
  return {
    recommendation: recommendationFrom(winner),
    score: round(winner.adjustedScore),
    breakdown: {
      tagOverlap: round(winner.tagOverlap),
      genreOverlap: round(winner.genreOverlap),
      graphSignal: round(winner.graphSignal),
      popularityPenalty: round(winner.popularityPenalty),
      recencyWeightApplied: seeds.filter((s) => s.usable).length > 1,
      divergence: preferences.divergence,
      divergenceApplied: preferences.divergence > 0
    },
    explanation: {
      matchedTags: winner.matchedTags,
      matchedGenres: winner.matchedGenres,
      sharedRelations: winner.sharedRelations,
      summary: buildSummary({ ...winner, mostRecentArtist: mostRecent.track.artist })
    },
    alternatives: alternativesFrom(ranked, options.alternatives),
    candidatePool: { mode: pool.mode, size: pool.candidates.length, ...counts, contrast: pool.contrast },
    seeds: seeds.map(seedSummary),
    warnings,
    skipped
  };
}

// Full pipeline: seeds -> pool -> tags + entities -> multi-signal score -> filters -> ranking
async function recommend(request) {
  const startedAt = Date.now();
  const { result, stats } = await http.withRequestStats(() => runPipeline(request, startedAt));
  const { skipped, ...body } = result;
  return { ...body, diagnostics: diagnosticsFrom(stats, startedAt, skipped) };
}

module.exports = { recommend, diagnosticsFrom };
