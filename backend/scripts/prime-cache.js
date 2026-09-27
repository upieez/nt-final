require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('../lib/http');
const { recommend } = require('../lib/recommend');
const { recommendBaseline } = require('../lib/baseline');
const { validateRecommendationRequest } = require('../lib/validate');

const SEED_FILE = path.join(__dirname, '..', '..', 'evaluation', 'seed-sequences.json');
const PREFERENCE_VARIANTS = [
  { genreStrictness: 0.5, discoveryFactor: 0.5 },
  { genreStrictness: 0.0, discoveryFactor: 0.0 },
  { genreStrictness: 0.0, discoveryFactor: 0.9 },
  { genreStrictness: 0.9, discoveryFactor: 0.0 },
  { genreStrictness: 0.5, discoveryFactor: 0.5, divergence: 1 }
];

// Fallback preliminary report cases
const REPORT_CASES = [
  { name: 'coherent post-punk', sequence: [{ artist: 'Joy Division', title: 'Disorder' }, { artist: 'Siouxsie and the Banshees', title: 'Cities in Dust' }, { artist: 'The Cure', title: 'A Forest' }] },
  { name: 'mixed hip-hop, ambient, metal', sequence: [{ artist: 'Nas', title: 'N.Y. State of Mind' }, { artist: 'Brian Eno', title: 'An Ending (Ascent)' }, { artist: 'Metallica', title: 'Master of Puppets' }] },
  { name: 'sparse metadata', sequence: [{ artist: 'Nick Drake', title: 'Pink Moon' }, { artist: 'Greg Mendez', title: 'Hoping You Pull Through' }, { artist: 'Tomberlin', title: 'Happy Accident' }] },
  { name: 'parameter toggle', sequence: [{ artist: 'Joy Division', title: 'Disorder' }, { artist: 'The Cure', title: 'A Forest' }] }
];

function loadCases() {
  if (!fs.existsSync(SEED_FILE)) return { source: 'report cases', cases: REPORT_CASES };
  const raw = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.sequences || [];
  const cases = list.map((entry, i) => ({ name: entry.name || entry.id || `sequence ${i + 1}`, sequence: Array.isArray(entry) ? entry : entry.sequence }));
  return { source: path.relative(process.cwd(), SEED_FILE), cases };
}

function summarise(body) {
  return `${body.recommendation.artist} - ${body.recommendation.title} (pool ${body.candidatePool.mode}/${body.candidatePool.size}, ${body.diagnostics.latencyMs} ms, ${body.diagnostics.upstreamCalls} upstream, match rate ${body.diagnostics.matchRate})`;
}

async function runCase(testCase, poolMode, totals) {
  for (const preferences of PREFERENCE_VARIANTS) {
    const request = validateRecommendationRequest({ sequence: testCase.sequence, preferences, options: { poolMode } });
    try {
      const body = await recommend(request);
      totals.ok += 1;
      totals.seedsResolved += body.seeds.filter((s) => s.resolved).length;
      totals.seeds += body.seeds.length;
      totals.latencies.push(body.diagnostics.latencyMs);
      if (preferences === PREFERENCE_VARIANTS[0]) console.log(`  ${poolMode}: ${summarise(body)}`);
    } catch (err) {
      totals.failed += 1;
      console.log(`  ${poolMode}: ${err.status || 'error'} ${err.message}`);
    }
  }
  for (const strategy of ['random', 'popular']) {
    await recommendBaseline({ sequence: testCase.sequence, strategy, options: { poolMode, poolSize: 40, alternatives: 5 }, preferences: { excludeArtists: [] } }).catch(() => null);
  }
}

function cacheCoverage() {
  const counts = {};
  for (const key of Object.keys(http.loadCache())) {
    const source = key.split(':')[0];
    counts[source] = (counts[source] || 0) + 1;
  }
  return counts;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

async function main() {
  if (!process.env.LASTFM_API_KEY) {
    console.error('LASTFM_API_KEY is required to prime the cache.');
    process.exit(1);
  }
  const { source, cases } = loadCases();
  console.log(`Priming cache from ${source}: ${cases.length} sequences x ${PREFERENCE_VARIANTS.length} preference variants x 2 pool modes`);
  const totals = { ok: 0, failed: 0, seeds: 0, seedsResolved: 0, latencies: [] };
  for (const testCase of cases) {
    console.log(`\n${testCase.name}`);
    await runCase(testCase, 'dynamic', totals);
    await runCase(testCase, 'fixed', totals);
    http.flushCache();
  }
  http.flushCache();
  console.log('\nCoverage');
  console.log(`  requests ok: ${totals.ok}, failed: ${totals.failed}`);
  console.log(`  seeds resolved: ${totals.seedsResolved}/${totals.seeds}`);
  console.log(`  latency p50: ${percentile(totals.latencies, 0.5)} ms, p95: ${percentile(totals.latencies, 0.95)} ms (includes cold upstream calls)`);
  console.log(`  cache entries by source: ${JSON.stringify(cacheCoverage())}`);
  console.log(`  snapshot: ${process.env.NEXTTRACK_CACHE_FILE || path.join(__dirname, '..', 'data', 'cache', 'snapshot.json')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
