const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('../../backend/lib/http');
const world = require('../../backend/test/helpers/world');
const { nock } = require('../../backend/test/helpers/upstream');
const { runHarness } = require('../lib/harness');
const { summarise, markdown, charts, writeResults } = require('../lib/report');

const SEQUENCES = [
  { id: 'post-punk', group: 'coherent', sequence: [{ artist: 'Joy Division', title: 'Disorder' }, { artist: 'The Cure', title: 'A Forest' }] },
  { id: 'unknown', group: 'sparse', sequence: [{ artist: 'Nobody Known', title: 'Nothing Here' }] }
];

let results;

beforeAll(async () => {
  http.resetCache();
  nock.cleanAll();
  world.install();
  results = await runHarness(SEQUENCES);
}, 30000);

describe('offline harness', () => {
  test('runs every system and the sensitivity pairs over a resolvable sequence', () => {
    const r = results[0];
    expect(r.systems.nexttrack.ok).toBe(true);
    expect(r.systems.popular.winner.title).toBe('Call Me Maybe');
    expect(r.systems.popular.popularityPercentile).toBe(1);
    expect(r.systems.nexttrack.tagCoherence).toBeGreaterThan(r.systems.popular.tagCoherence);
    expect(r.systems.nexttrack.genreContinuation).toBe(true);
    expect(r.systems.random.draws).toBe(20);
    expect(r.systems.random.tagCoherence).toBeGreaterThanOrEqual(0);
    expect(Object.keys(r.sensitivity)).toEqual(['discoveryFactor', 'genreStrictness', 'divergence']);
    expect(r.sensitivity.divergence.ok).toBe(true);
    expect(typeof r.sensitivity.divergence.changed).toBe('boolean');
    expect(r.systems.nexttrack.seeds.every((s) => s.mbid)).toBe(true);
  });

  test('random draws are reproducible across runs with the fixed seed', async () => {
    const again = await runHarness([SEQUENCES[0]]);
    expect(again[0].systems.random.tagCoherence).toBe(results[0].systems.random.tagCoherence);
    expect(again[0].systems.random.winners).toBe(results[0].systems.random.winners);
  }, 30000);

  test('records failures instead of fabricating a result', () => {
    const r = results[1];
    expect(r.systems.nexttrack.ok).toBe(false);
    expect(r.systems.nexttrack.error.status).toBe(422);
    expect(r.sensitivity.discoveryFactor.ok).toBe(false);
    expect(r.sensitivity.discoveryFactor.error.status).toBe(422);
  });

  test('summary aggregates wins, seeds, sensitivity and the success criteria', () => {
    const summary = summarise(results, { mode: 'test', seedFile: 'fixture', snapshot: { file: 'none', entries: 0 } });
    expect(summary.sequences).toEqual({ total: 2, byGroup: { coherent: 1, mixed: 0, sparse: 1 }, failed: 1 });
    expect(summary.wins.tagCoherence).toEqual({ wins: 1, of: 1, rate: 1, skipped: 1 });
    expect(summary.seeds.total).toBe(3);
    expect(summary.seeds.withMbid).toBe(2);
    expect(summary.seeds.mbidRate).toBeCloseTo(0.667, 3);
    expect(summary.sensitivity.discoveryFactor.of).toBe(1);
    expect(summary.systems.nexttrack.latencyMs.p95).toEqual(expect.any(Number));
    const ids = summary.criteria.map((c) => c.id);
    expect(ids).toEqual(['coherence-wins', 'genre-wins', 'seed-mbid', 'discovery-sensitivity', 'latency-p95', 'error-paths', 'blind-study']);
    expect(summary.criteria.find((c) => c.id === 'seed-mbid').pass).toBe(false);
    expect(summary.criteria.find((c) => c.id === 'error-paths').pass).toBeNull();
  });

  test('writes json, markdown tables and four svg charts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexttrack-harness-'));
    const summary = summarise(results, { mode: 'test', seedFile: 'fixture', snapshot: { file: 'none', entries: 0 } });
    writeResults(dir, summary, results);
    expect(fs.readdirSync(dir).sort()).toEqual(['coherence-by-group.svg', 'latency.svg', 'popularity-percentile.svg', 'results.json', 'results.md', 'sensitivity.svg']);
    const md = markdown(summary, results);
    expect(md).toContain('## Success criteria');
    expect(md).toContain('| unknown | nexttrack | 422 |');
    expect(md).toContain('cache-warm');
    for (const content of Object.values(charts(summary, results))) expect(content.startsWith('<svg')).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8')).sequences).toHaveLength(2);
  });
});
