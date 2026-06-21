const RECENCY_BASE = 0.6;
const STRICTNESS_THRESHOLD = 0.7;

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

// Seeds are ordered least recent to most recent; weight decays by 0.6 per step back
function buildSequenceTagSet(resolvedSeeds) {
  const sequenceTagWeights = new Map();
  const n = resolvedSeeds.length;
  let mostRecentTags = new Map();
  resolvedSeeds.forEach((seed, index) => {
    const positionsBack = n - 1 - index;
    const recencyWeight = Math.pow(RECENCY_BASE, positionsBack);
    const normalised = normaliseTags(seed.tags);
    if (positionsBack === 0) mostRecentTags = normalised;
    for (const [tag, weight] of normalised) {
      sequenceTagWeights.set(tag, (sequenceTagWeights.get(tag) || 0) + weight * recencyWeight);
    }
  });
  return { sequenceTagWeights, mostRecentTags };
}

// Raw score is the weighted overlap between candidate tags and the sequence tag set
function scoreCandidate(candidateTags, sequenceTagWeights, mostRecentTags) {
  const normalised = normaliseTags(candidateTags);
  let rawScore = 0;
  const matchedTags = [];
  let overlapsMostRecent = false;
  for (const [tag, candWeight] of normalised) {
    const seqWeight = sequenceTagWeights.get(tag);
    if (seqWeight) {
      rawScore += seqWeight * candWeight;
      matchedTags.push(tag);
    }
    if (mostRecentTags.has(tag)) overlapsMostRecent = true;
  }
  return { rawScore, matchedTags, overlapsMostRecent };
}

function normalisePopularity(listeners, maxListeners) {
  if (!maxListeners || maxListeners <= 0) return 0;
  return Math.log((listeners || 0) + 1) / Math.log(maxListeners + 1);
}

// Penalty is proportional to the raw score so it scales instead of flattening
function applyDiscoveryPenalty(rawScore, listeners, maxListeners, discoveryFactor) {
  const normalisedPopularity = normalisePopularity(listeners, maxListeners);
  return { adjustedScore: rawScore * (1 - discoveryFactor * normalisedPopularity), normalisedPopularity };
}

// Ties go to the less popular candidate
function rankCandidates(scored) {
  return [...scored].sort((a, b) => {
    if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore;
    return (a.listeners || 0) - (b.listeners || 0);
  });
}

module.exports = {
  RECENCY_BASE,
  STRICTNESS_THRESHOLD,
  normaliseTags,
  buildSequenceTagSet,
  scoreCandidate,
  normalisePopularity,
  applyDiscoveryPenalty,
  rankCandidates
};
