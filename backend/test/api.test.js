const request = require('supertest');
const http = require('../lib/http');
const app = require('../app');
const world = require('./helpers/world');
const { nock } = require('./helpers/upstream');

const SEQUENCE = [{ artist: 'Joy Division', title: 'Disorder' }, { artist: 'The Cure', title: 'A Forest' }];
const post = (body) => request(app).post('/api/v1/recommendations/next-track').send(body);

beforeEach(() => {
  http.resetCache();
  nock.cleanAll();
});

describe('POST /api/v1/recommendations/next-track', () => {
  test('happy path returns the full contract shape', async () => {
    world.install();
    const res = await post({ sequence: SEQUENCE, preferences: { genreStrictness: 0.5, discoveryFactor: 0.5 }, options: { poolMode: 'dynamic', poolSize: 40, alternatives: 3 } });
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.recommendation).toEqual({ artist: 'Siouxsie and the Banshees', title: 'Spellbound', mbid: 'rec-spellbound', wikidataId: 'Q5', listeners: 650000, tags: ['post-punk', 'gothic rock', 'new wave', '80s'] });
    expect(typeof body.score).toBe('number');
    expect(body.breakdown).toEqual({ tagOverlap: expect.any(Number), genreOverlap: expect.any(Number), graphSignal: expect.any(Number), popularityPenalty: expect.any(Number), recencyWeightApplied: true, divergence: 0, divergenceApplied: false });
    expect(body.explanation.matchedTags).toContain('post-punk');
    expect(body.explanation.matchedGenres).toEqual(['post-punk', 'gothic rock']);
    expect(body.explanation.sharedRelations).toContainEqual({ type: 'country', value: 'GB', with: 'The Cure' });
    expect(body.explanation.summary).toBe('Shares post-punk, gothic rock and new wave with your most recent tracks, and has the same country as Joy Division and The Cure.');
    expect(body.alternatives).toHaveLength(3);
    expect(body.alternatives[0]).toEqual({ artist: expect.any(String), title: expect.any(String), score: expect.any(Number), matchedTags: expect.any(Array) });
    expect(body.candidatePool).toEqual({ mode: 'dynamic', size: 10, scored: 10, scoreless: 0, excluded: 0, contrast: 0 });
    expect(body.seeds).toEqual([
      { artist: 'Joy Division', title: 'Disorder', resolved: true, mbid: 'rec-disorder', tagSource: 'artist' },
      { artist: 'The Cure', title: 'A Forest', resolved: true, mbid: 'rec-forest', tagSource: 'track' }
    ]);
    expect(body.diagnostics).toEqual({ latencyMs: expect.any(Number), cacheHits: expect.any(Number), cacheMisses: expect.any(Number), upstreamCalls: expect.any(Number), matchRate: 1, enrichmentSkipped: 0 });
    expect(body.warnings).toEqual([{ track: 'Joy Division - Disorder', issue: expect.stringContaining('artist-level tags') }]);
  });

  test('a second identical request is served from the cache with no upstream calls', async () => {
    world.install();
    await post({ sequence: SEQUENCE });
    const res = await post({ sequence: SEQUENCE });
    expect(res.body.diagnostics.upstreamCalls).toBe(0);
    expect(res.body.diagnostics.cacheMisses).toBe(0);
    expect(res.body.diagnostics.cacheHits).toBeGreaterThan(20);
  });

  test('a graph relation shows up when the candidate shares a member and label with a seed', async () => {
    world.install();
    const res = await post({ sequence: [{ artist: 'Joy Division', title: 'Disorder' }], preferences: { discoveryFactor: 0 } });
    expect(res.status).toBe(200);
    const ceremony = [res.body.recommendation, ...res.body.alternatives].find((t) => t.title === 'Ceremony');
    expect(ceremony).toBeDefined();
    if (res.body.recommendation.title === 'Ceremony') {
      expect(res.body.explanation.sharedRelations).toContainEqual({ type: 'member', value: 'Peter Hook', with: 'Joy Division' });
      expect(res.body.explanation.sharedRelations).toContainEqual({ type: 'label', value: 'Factory Records', with: 'Joy Division' });
      expect(res.body.breakdown.graphSignal).toBe(1);
    }
  });

  test('empty sequence is a 400 with details', async () => {
    const res = await post({ sequence: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(res.body.details[0]).toMatch(/non-empty array/);
  });

  test('more than ten items is a 400', async () => {
    const res = await post({ sequence: Array.from({ length: 11 }, () => SEQUENCE[0]) });
    expect(res.status).toBe(400);
    expect(res.body.details).toContain('sequence may contain at most 10 items');
  });

  test('non-string fields and bad option values are a 400 listing every problem', async () => {
    const res = await post({ sequence: [{ artist: 42, title: '' }], preferences: { excludeArtists: 'The Cure', targetGenre: 7 }, options: { poolMode: 'huge' } });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      'sequence[0].artist must be a non-empty string of at most 200 characters',
      'sequence[0].title must be a non-empty string of at most 200 characters',
      'preferences.targetGenre must be a string',
      'preferences.excludeArtists must be an array of strings',
      'options.poolMode must be "dynamic" or "fixed"'
    ]);
  });

  test('malformed JSON is a 400', async () => {
    const res = await request(app).post('/api/v1/recommendations/next-track').set('Content-Type', 'application/json').send('{"sequence": [');
    expect(res.status).toBe(400);
  });

  test('out-of-range preferences are clamped rather than rejected', async () => {
    world.install();
    const high = await post({ sequence: SEQUENCE, preferences: { discoveryFactor: 7, genreStrictness: -3 } });
    const clamped = await post({ sequence: SEQUENCE, preferences: { discoveryFactor: 1, genreStrictness: 0 } });
    expect(high.status).toBe(200);
    expect(high.body.recommendation).toEqual(clamped.body.recommendation);
    expect(high.body.score).toBe(clamped.body.score);
  });

  test('no resolvable seed is a 422 with warnings', async () => {
    world.install();
    const res = await post({ sequence: [{ artist: 'Nobody Known', title: 'Silence' }] });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/could be resolved/);
    expect(res.body.warnings[0].track).toBe('Nobody Known - Silence');
  });

  test('an upstream timeout on every seed is a 504 naming the source', async () => {
    nock('https://ws.audioscrobbler.com').persist().get('/2.0/').query(true).replyWithError({ code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' });
    nock('https://musicbrainz.org').persist().get(/.*/).query(true).reply(503, {});
    const res = await post({ sequence: SEQUENCE });
    expect(res.status).toBe(504);
    expect(res.body).toEqual({ error: 'Upstream request to lastfm timed out', source: 'lastfm' });
  });

  test('an upstream failure on every seed is a 502 naming the source', async () => {
    nock('https://ws.audioscrobbler.com').persist().get('/2.0/').query(true).reply(500, { error: 'boom' });
    nock('https://musicbrainz.org').persist().get(/.*/).query(true).reply(503, {});
    const res = await post({ sequence: SEQUENCE });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Upstream request to lastfm failed', source: 'lastfm' });
  });

  test('fixed pool mode scores the bundled candidates instead of Last.fm neighbours', async () => {
    world.install();
    const res = await post({ sequence: SEQUENCE, options: { poolMode: 'fixed', poolSize: 80 } });
    expect(res.status).toBe(200);
    expect(res.body.candidatePool.mode).toBe('fixed');
    expect(res.body.candidatePool.size).toBe(46);
    expect(res.body.candidatePool.scored).toBeGreaterThan(0);
    expect(res.body.candidatePool.excluded).toBeGreaterThan(0);
    expect(res.body.candidatePool.scored + res.body.candidatePool.scoreless + res.body.candidatePool.excluded).toBe(46);
  });

  test('dynamic mode falls back to the fixed pool with a warning when neighbours are unavailable', async () => {
    world.install({ 'track.getsimilar': world.NOT_FOUND, 'artist.getsimilar': world.NOT_FOUND });
    const res = await post({ sequence: SEQUENCE });
    expect(res.status).toBe(200);
    expect(res.body.candidatePool.mode).toBe('fixed');
    expect(res.body.warnings).toContainEqual({ track: '(pool)', issue: expect.stringContaining('fell back to the fixed candidate pool') });
  });

  test('targetGenre keeps only candidates carrying that genre', async () => {
    world.install();
    const res = await post({ sequence: SEQUENCE, preferences: { targetGenre: 'Pop' } });
    expect(res.status).toBe(200);
    expect(res.body.recommendation.artist).toBe('Carly Rae Jepsen');
    expect(res.body.candidatePool.scored).toBe(1);
    expect(res.body.candidatePool.excluded).toBe(9);
    const none = await post({ sequence: SEQUENCE, preferences: { targetGenre: 'polka' } });
    expect(none.status).toBe(422);
    expect(none.body.error).toMatch(/target genre "polka"/);
  });

  test('discovery factor changes the winner toward a less popular track', async () => {
    world.install();
    const mainstream = await post({ sequence: SEQUENCE, preferences: { discoveryFactor: 0 } });
    const obscure = await post({ sequence: SEQUENCE, preferences: { discoveryFactor: 1 } });
    expect(mainstream.body.recommendation.title).not.toBe(obscure.body.recommendation.title);
    expect(obscure.body.recommendation.listeners).toBeLessThan(mainstream.body.recommendation.listeners);
    expect(obscure.body.breakdown.popularityPenalty).toBeGreaterThan(0);
    expect(mainstream.body.breakdown.popularityPenalty).toBe(0);
  });

  test('divergence 0 leaves the ranking unchanged and divergence 1 flips the winner to the least similar track', async () => {
    world.install();
    const base = await post({ sequence: SEQUENCE, preferences: { discoveryFactor: 0 } });
    const same = await post({ sequence: SEQUENCE, preferences: { discoveryFactor: 0, divergence: 0 } });
    const far = await post({ sequence: SEQUENCE, preferences: { discoveryFactor: 0, divergence: 1 } });
    expect(same.body.recommendation).toEqual(base.body.recommendation);
    expect(same.body.score).toBe(base.body.score);
    expect(far.body.recommendation.title).not.toBe(base.body.recommendation.title);
    expect(far.body.breakdown).toMatchObject({ divergence: 1, divergenceApplied: true });
    expect(far.body.candidatePool.contrast).toBe(2);
    expect(far.body.explanation.matchedTags).toEqual([]);
    expect(far.body.score).toBeCloseTo(1 - (far.body.breakdown.tagOverlap * 0.5 + far.body.breakdown.genreOverlap * 0.3 + far.body.breakdown.graphSignal * 0.2), 3);
    const clamped = await post({ sequence: SEQUENCE, preferences: { discoveryFactor: 0, divergence: 4 } });
    expect(clamped.body.recommendation).toEqual(far.body.recommendation);
  });

  test('high divergence ignores genreStrictness with a warning while targetGenre still applies', async () => {
    world.install();
    const res = await post({ sequence: SEQUENCE, preferences: { divergence: 0.8, genreStrictness: 0.9 }, options: { alternatives: 10 } });
    expect(res.status).toBe(200);
    expect(res.body.candidatePool.excluded).toBe(0);
    expect(res.body.warnings).toContainEqual({ track: '(preferences)', issue: 'genreStrictness 0.9 ignored because divergence 0.8 asks for something different' });
    const targeted = await post({ sequence: SEQUENCE, preferences: { divergence: 0.8, genreStrictness: 0.9, targetGenre: 'jazz' } });
    expect(targeted.body.recommendation.title).toBe('So What');
    expect(targeted.body.candidatePool.scored).toBe(1);
  });

  test('high genreStrictness excludes candidates that share nothing with the most recent seed', async () => {
    world.install();
    const loose = await post({ sequence: SEQUENCE, preferences: { genreStrictness: 0 }, options: { alternatives: 10 } });
    const strict = await post({ sequence: SEQUENCE, preferences: { genreStrictness: 0.9 }, options: { alternatives: 10 } });
    const titles = (body) => [body.recommendation.title, ...body.alternatives.map((a) => a.title)];
    expect(titles(loose.body)).toContain('Call Me Maybe');
    expect(titles(strict.body)).not.toContain('Call Me Maybe');
    expect(strict.body.candidatePool.excluded).toBe(1);
  });

  test('excludeArtists removes an artist from the pool', async () => {
    world.install();
    const res = await post({ sequence: SEQUENCE, preferences: { excludeArtists: ['Siouxsie and the Banshees'] } });
    expect(res.body.recommendation.artist).not.toBe('Siouxsie and the Banshees');
    expect(res.body.candidatePool.excluded).toBe(2);
  });

  test('offline mode serves a warmed request from the snapshot and reports misses without calling out', async () => {
    world.install();
    await post({ sequence: SEQUENCE });
    nock.cleanAll();
    process.env.NEXTTRACK_OFFLINE = '1';
    const warm = await post({ sequence: SEQUENCE });
    const cold = await post({ sequence: [{ artist: 'Unknown', title: 'Thing' }] });
    delete process.env.NEXTTRACK_OFFLINE;
    expect(warm.status).toBe(200);
    expect(warm.body.recommendation.title).toBe('Spellbound');
    expect(warm.body.diagnostics.upstreamCalls).toBe(0);
    expect(cold.status).toBe(422);
    expect(cold.body.warnings[0]).toEqual({ track: 'Unknown - Thing', issue: 'not in the offline cache' });
  });

  test('unknown routes are a JSON 404', async () => {
    const res = await request(app).get('/api/v1/nothing');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
