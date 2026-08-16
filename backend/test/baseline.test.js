const request = require('supertest');
const http = require('../lib/http');
const app = require('../app');
const world = require('./helpers/world');
const { nock } = require('./helpers/upstream');

const SEQUENCE = [{ artist: 'Joy Division', title: 'Disorder' }, { artist: 'The Cure', title: 'A Forest' }];
const post = (body) => request(app).post('/api/v1/recommendations/baseline').send(body);

beforeEach(() => {
  http.resetCache();
  nock.cleanAll();
  world.install();
});

describe('POST /api/v1/recommendations/baseline', () => {
  test('popular strategy picks the candidate with the most listeners from the same pool', async () => {
    const res = await post({ sequence: SEQUENCE, strategy: 'popular' });
    expect(res.status).toBe(200);
    expect(res.body.strategy).toBe('popular');
    expect(res.body.recommendation).toMatchObject({ artist: 'Carly Rae Jepsen', title: 'Call Me Maybe', listeners: 2380904, mbid: 'rec-cmm', wikidataId: 'Q7' });
    expect(res.body.breakdown).toBeUndefined();
    expect(res.body.score).toBeNull();
    expect(res.body.alternatives[0].title).toBe('Blue Monday');
    expect(res.body.candidatePool).toEqual({ mode: 'dynamic', size: 10, scored: 10, scoreless: 0, excluded: 0 });
    expect(res.body.seeds).toHaveLength(2);
    expect(res.body.diagnostics.latencyMs).toEqual(expect.any(Number));
  });

  test('random strategy returns a pool member and never a seed', async () => {
    const poolTitles = new Set(Object.keys(world.TRACKS).map((k) => k.split('|')[1]));
    for (let i = 0; i < 5; i += 1) {
      const res = await post({ sequence: SEQUENCE, strategy: 'random' });
      expect(res.status).toBe(200);
      expect(poolTitles.has(res.body.recommendation.title)).toBe(true);
      expect(['Disorder', 'A Forest']).not.toContain(res.body.recommendation.title);
      expect(res.body.explanation.summary).toMatch(/random/);
    }
  });

  test('strategy defaults to random and rejects unknown values', async () => {
    const ok = await post({ sequence: SEQUENCE });
    expect(ok.body.strategy).toBe('random');
    const bad = await post({ sequence: SEQUENCE, strategy: 'best' });
    expect(bad.status).toBe(400);
    expect(bad.body.details).toContain('strategy must be "random" or "popular"');
  });

  test('fixed pool mode is honoured', async () => {
    const res = await post({ sequence: SEQUENCE, strategy: 'popular', options: { poolMode: 'fixed', poolSize: 80 } });
    expect(res.body.candidatePool.mode).toBe('fixed');
    expect(res.body.candidatePool.size).toBe(46);
  });
});
