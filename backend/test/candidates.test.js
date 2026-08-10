const http = require('../lib/http');
const { buildPool, clampPoolSize, FIXED_POOL, MAX_POOL_SIZE } = require('../lib/candidates');
const world = require('./helpers/world');
const { nock, lastfm } = require('./helpers/upstream');

const SEEDS = [{ artist: 'Joy Division', title: 'Disorder' }, { artist: 'The Cure', title: 'A Forest' }];

beforeEach(() => {
  http.resetCache();
  nock.cleanAll();
});

describe('candidate pool', () => {
  test('dynamic pool gathers similar tracks and similar-artist top tracks, minus seeds, de-duplicated', async () => {
    world.install();
    const pool = await buildPool({ seeds: SEEDS, poolMode: 'dynamic', poolSize: 40 });
    const keys = pool.candidates.map((c) => `${c.artist}|${c.title}`);
    expect(pool.mode).toBe('dynamic');
    expect(keys).not.toContain('The Cure|A Forest');
    expect(keys).not.toContain('Joy Division|Disorder');
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('Siouxsie and the Banshees|Spellbound');
    expect(keys).toContain('New Order|Ceremony');
    expect(pool.candidates[0].origin).toBe('similar-track');
  });

  test('excluded artists are removed and counted', async () => {
    world.install();
    const pool = await buildPool({ seeds: SEEDS, poolMode: 'dynamic', poolSize: 40, excludeArtists: ['carly rae jepsen', 'BAUHAUS'] });
    expect(pool.candidates.some((c) => c.artist === 'Bauhaus')).toBe(false);
    expect(pool.candidates.some((c) => c.artist === 'Carly Rae Jepsen')).toBe(false);
    expect(pool.excluded).toBe(3);
  });

  test('pool size caps the result', async () => {
    world.install();
    const pool = await buildPool({ seeds: SEEDS, poolMode: 'dynamic', poolSize: 3 });
    expect(pool.candidates).toHaveLength(3);
    expect(clampPoolSize(500)).toBe(MAX_POOL_SIZE);
    expect(clampPoolSize('abc')).toBe(40);
    expect(clampPoolSize(0)).toBe(1);
  });

  test('fixed mode uses the bundled file without any network call', async () => {
    const pool = await buildPool({ seeds: [{ artist: 'Bauhaus', title: "Bela Lugosi's Dead (Live)" }], poolMode: 'fixed', poolSize: 80 });
    expect(pool.mode).toBe('fixed');
    expect(pool.candidates).toHaveLength(FIXED_POOL.length - 1);
    expect(pool.candidates.every((c) => c.origin === 'fixed')).toBe(true);
  });

  test('falls back to the fixed pool when Last.fm cannot supply neighbours', async () => {
    lastfm('track.getsimilar', {}, world.NOT_FOUND).persist();
    lastfm('artist.getsimilar', {}, world.NOT_FOUND).persist();
    const pool = await buildPool({ seeds: SEEDS, poolMode: 'dynamic', poolSize: 40 });
    expect(pool.mode).toBe('fixed');
    expect(pool.fallbackReason).toMatch(/too small/);
  });

  test('records upstream failures and falls back when the similarity calls time out', async () => {
    nock('https://ws.audioscrobbler.com').persist().get('/2.0/').query(true).replyWithError({ code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' });
    const pool = await buildPool({ seeds: SEEDS, poolMode: 'dynamic', poolSize: 40 });
    expect(pool.mode).toBe('fixed');
    expect(pool.failures[0]).toEqual({ source: 'lastfm', status: 'timeout' });
    expect(pool.fallbackReason).toMatch(/lastfm timeout/);
  });
});
