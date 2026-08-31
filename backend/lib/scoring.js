const { sameName, normaliseName } = require('./reconcile');

// Signal weights, documented with the formula in docs/scoring.md
const W_TAG = 0.5;
const W_GENRE = 0.3;
const W_GRAPH = 0.2;
const GRAPH_WEIGHTS = { member: 0.5, label: 0.4, artist: 0.3, country: 0.1 };
const RECENCY_BASE = 0.6;
const STRICTNESS_THRESHOLD = 0.7;
const SOFT_STRICTNESS = 0.5;
const DIVERGENCE_THRESHOLD = 0.5;
// Artist tags describe a whole catalogue, so they count as weaker evidence than track tags
const ARTIST_TAG_CONFIDENCE = 0.6;

// Scale tag weights so each track's tags sum to 1
function normaliseTags(tags) {
  const map = new Map();
  if (!tags || tags.length === 0) return map;
  const total = tags.reduce((sum, t) => sum + (t.weight || 0), 0);
  for (const t of tags) {
    map.set(t.name.toLowerCase(), total > 0 ? (t.weight || 0) / total : 1 / tags.length);
  }
  return map;
}

function recencyWeight(index, count) {
  return Math.pow(RECENCY_BASE, count - 1 - index);
}

function addWeighted(target, source, factor) {
  for (const [key, weight] of source) target.set(key, (target.get(key) || 0) + weight * factor);
}

// Keys are normalised for matching; the first original spelling is kept for display
function uniformSet(names) {
  const map = new Map();
  const display = new Map();
  for (const name of names || []) {
    const key = normaliseName(name);
    if (key && !display.has(key)) display.set(key, name);
  }
  for (const key of display.keys()) map.set(key, 1 / display.size);
  map.display = display;
  return map;
}

// Seeds are ordered least recent to most recent; weight decays by 0.6 per step back
function buildSequenceTagSet(resolvedSeeds) {
  const sequenceTagWeights = new Map();
  let mostRecentTags = new Map();
  resolvedSeeds.forEach((seed, index) => {
    const normalised = normaliseTags(seed.tags);
    if (index === resolvedSeeds.length - 1) mostRecentTags = normalised;
    addWeighted(sequenceTagWeights, normalised, recencyWeight(index, resolvedSeeds.length) * (seed.confidence ?? 1));
  });
  return { sequenceTagWeights, mostRecentTags };
}

// Genres from MusicBrainz and Wikidata are unweighted, so each seed's genres share its recency weight equally
function buildSequenceGenreSet(resolvedSeeds) {
  const sequenceGenreWeights = new Map();
  let mostRecentGenres = new Map();
  resolvedSeeds.forEach((seed, index) => {
    const normalised = uniformSet(seed.genres);
    if (index === resolvedSeeds.length - 1) mostRecentGenres = normalised;
    addWeighted(sequenceGenreWeights, normalised, recencyWeight(index, resolvedSeeds.length));
  });
  return { sequenceGenreWeights, mostRecentGenres };
}

function magnitude(map) {
  let sum = 0;
  for (const value of map.values()) sum += value * value;
  return Math.sqrt(sum);
}

// Cosine similarity between the candidate tag vector and the recency-weighted sequence tag vector
function scoreCandidate(candidateTags, sequenceTagWeights, mostRecentTags, candidateConfidence = 1) {
  const normalised = normaliseTags(candidateTags);
  let dot = 0;
  const matchedTags = [];
  let overlapsMostRecent = false;
  for (const [tag, candWeight] of normalised) {
    const seqWeight = sequenceTagWeights.get(tag);
    if (seqWeight) {
      dot += seqWeight * candWeight;
      matchedTags.push(tag);
    }
    if (mostRecentTags.has(tag)) overlapsMostRecent = true;
  }
  const denominator = magnitude(normalised) * magnitude(sequenceTagWeights);
  const tagOverlap = denominator > 0 ? (dot / denominator) * candidateConfidence : 0;
  return { tagOverlap, matchedTags, overlapsMostRecent };
}

// Share of the sequence's recency-weighted genre mass that the candidate covers
function scoreGenres(candidateGenres, sequenceGenreWeights, mostRecentGenres) {
  const candidate = uniformSet(candidateGenres);
  let total = 0;
  let covered = 0;
  const matchedGenres = [];
  for (const [genre, weight] of sequenceGenreWeights) {
    total += weight;
    if (candidate.has(genre)) {
      covered += weight;
      matchedGenres.push(candidate.display.get(genre));
    }
  }
  const overlapsMostRecent = [...candidate.keys()].some((g) => mostRecentGenres.has(g));
  return { genreOverlap: total > 0 ? covered / total : 0, matchedGenres, overlapsMostRecent };
}

function intersectNames(a, b) {
  return (a || []).filter((x) => (b || []).some((y) => sameName(x, y)));
}

function memberRelation(candidate, seed) {
  if (sameName(candidate.name, seed.name)) return null;
  const shared = intersectNames(candidate.members, seed.members);
  if (shared.length) return { type: 'member', value: shared[0] };
  if ((seed.members || []).some((m) => sameName(m, candidate.name))) return { type: 'member', value: candidate.name };
  if ((candidate.members || []).some((m) => sameName(m, seed.name))) return { type: 'member', value: seed.name };
  const groups = intersectNames(candidate.memberOf, seed.memberOf);
  if (groups.length) return { type: 'member', value: groups[0] };
  if ((candidate.memberOf || []).some((g) => sameName(g, seed.name))) return { type: 'member', value: seed.name };
  if ((seed.memberOf || []).some((g) => sameName(g, candidate.name))) return { type: 'member', value: candidate.name };
  return null;
}

// Relations between one candidate artist and one seed artist, each type at most once
function relationsBetween(candidate, seed) {
  if (!candidate || !seed || !candidate.name || !seed.name) return [];
  if (candidate.mbid && candidate.mbid === seed.mbid) return [{ type: 'artist', value: seed.name }];
  const relations = [];
  const member = memberRelation(candidate, seed);
  if (member) relations.push(member);
  const labels = intersectNames(candidate.labels, seed.labels);
  if (labels.length) relations.push({ type: 'label', value: labels[0] });
  if (candidate.country && candidate.country === seed.country) relations.push({ type: 'country', value: candidate.country });
  return relations;
}

// Recency-weighted mean of per-seed relation strength, each pair capped at 1
function scoreGraph(candidateArtist, seedArtists) {
  const sharedRelations = [];
  let total = 0;
  let sum = 0;
  seedArtists.forEach((seed, index) => {
    const weight = recencyWeight(index, seedArtists.length);
    total += weight;
    const relations = relationsBetween(candidateArtist, seed);
    const strength = Math.min(1, relations.reduce((acc, r) => acc + GRAPH_WEIGHTS[r.type], 0));
    sum += weight * strength;
    for (const r of relations) sharedRelations.push({ ...r, with: seed.name });
  });
  return { graphSignal: total > 0 ? sum / total : 0, sharedRelations };
}

function combineSignals({ tagOverlap, genreOverlap, graphSignal }) {
  return W_TAG * tagOverlap + W_GENRE * genreOverlap + W_GRAPH * graphSignal;
}

// Blends similarity toward its complement so at divergence 1 the least similar candidate ranks first
function applyDivergence(rawScore, divergence) {
  return (1 - divergence) * rawScore + divergence * (1 - rawScore);
}

function highDivergence(divergence) {
  return divergence >= DIVERGENCE_THRESHOLD;
}

function normalisePopularity(listeners, maxListeners) {
  if (!maxListeners || maxListeners <= 0) return 0;
  return Math.log((listeners || 0) + 1) / Math.log(maxListeners + 1);
}

// Penalty is proportional to the raw score so it scales instead of flattening
function applyDiscoveryPenalty(rawScore, listeners, maxListeners, discoveryFactor) {
  const normalisedPopularity = normalisePopularity(listeners, maxListeners);
  const popularityPenalty = rawScore * discoveryFactor * normalisedPopularity;
  return { adjustedScore: rawScore - popularityPenalty, popularityPenalty, normalisedPopularity };
}

// Below the hard threshold strictness still damps candidates that ignore the most recent seed
function applyStrictness(score, overlapsMostRecent, genreStrictness) {
  if (overlapsMostRecent || genreStrictness >= STRICTNESS_THRESHOLD) return score;
  return score * (1 - genreStrictness * SOFT_STRICTNESS);
}

function matchesTargetGenre(targetGenre, tags, genres) {
  const target = normaliseName(targetGenre);
  if (!target) return true;
  const names = [...(tags || []).map((t) => t.name), ...(genres || [])];
  return names.some((n) => normaliseName(n) === target);
}

// Ties go to the less popular candidate
function rankCandidates(scored) {
  return [...scored].sort((a, b) => {
    if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore;
    return (a.listeners || 0) - (b.listeners || 0);
  });
}

module.exports = {
  W_TAG,
  W_GENRE,
  W_GRAPH,
  GRAPH_WEIGHTS,
  RECENCY_BASE,
  STRICTNESS_THRESHOLD,
  DIVERGENCE_THRESHOLD,
  ARTIST_TAG_CONFIDENCE,
  normaliseTags,
  buildSequenceTagSet,
  buildSequenceGenreSet,
  scoreCandidate,
  scoreGenres,
  scoreGraph,
  relationsBetween,
  combineSignals,
  applyDiscoveryPenalty,
  applyDivergence,
  highDivergence,
  applyStrictness,
  matchesTargetGenre,
  rankCandidates
};
