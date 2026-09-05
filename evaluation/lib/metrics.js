const { normaliseTags } = require('../../backend/lib/scoring');
const { normaliseName } = require('../../backend/lib/reconcile');

function magnitude(map) {
  let sum = 0;
  for (const v of map.values()) sum += v * v;
  return Math.sqrt(sum);
}

// Cosine similarity between two weighted tag lists [{ name, weight }], 0 when either is empty
function tagCoherence(tagsA, tagsB) {
  const a = normaliseTags(tagsA);
  const b = normaliseTags(tagsB);
  let dot = 0;
  for (const [name, weight] of a) dot += weight * (b.get(name) || 0);
  const denominator = magnitude(a) * magnitude(b);
  return denominator > 0 ? dot / denominator : 0;
}

function sharesAny(namesA, namesB) {
  const set = new Set((namesA || []).map(normaliseName).filter(Boolean));
  return (namesB || []).some((n) => set.has(normaliseName(n)));
}

// Mid-rank percentile of the winner's listeners within the pool: 1 is the most popular, 0 the least
function popularityPercentile(listeners, poolListeners) {
  const others = poolListeners.filter((v) => Number.isFinite(v));
  if (others.length < 2 || !Number.isFinite(listeners)) return null;
  const below = others.filter((v) => v < listeners).length;
  const ties = others.filter((v) => v === listeners).length - 1;
  return (below + Math.max(0, ties) * 0.5) / (others.length - 1);
}

function mean(values) {
  const list = values.filter(Number.isFinite);
  return list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;
}

// Nearest-rank percentile, so p50 of [1, 2, 3, 4] is 2 and p95 is the largest value
function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function rate(flags) {
  const list = flags.filter((f) => typeof f === 'boolean');
  return list.length ? list.filter(Boolean).length / list.length : null;
}

function fiveNumber(values) {
  return { min: percentile(values, 0), p25: percentile(values, 0.25), p50: percentile(values, 0.5), p75: percentile(values, 0.75), p95: percentile(values, 0.95), max: percentile(values, 1) };
}

function logChoose(n, k) {
  let result = 0;
  for (let i = 1; i <= k; i += 1) result += Math.log(n - k + i) - Math.log(i);
  return result;
}

// Two-sided exact sign test: ties are dropped, p is the binomial tail probability at 0.5 doubled
function signTest(wins, losses) {
  const n = wins + losses;
  if (n === 0) return { n, wins, losses, pValue: null };
  const k = Math.min(wins, losses);
  let tail = 0;
  for (let i = 0; i <= k; i += 1) tail += Math.exp(logChoose(n, i) - n * Math.LN2);
  return { n, wins, losses, pValue: Math.min(1, 2 * tail) };
}

// Small deterministic PRNG so the random baseline is reproducible across runs
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}

module.exports = { tagCoherence, sharesAny, popularityPercentile, mean, median, percentile, rate, fiveNumber, signTest, mulberry32, round };
