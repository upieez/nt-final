const http = require('../lib/http');
const { lastfm, nock } = require('./helpers/upstream');

beforeEach(() => {
  http.resetCache();
  nock.cleanAll();
  delete process.env.NEXTTRACK_OFFLINE;
});

afterAll(() => nock.restore());

const call = () => http.request('lastfm', { params: { method: 'track.getinfo', artist: 'The Cure', track: 'A Forest' } });

describe('http layer', () => {
  test('caches a successful response and serves the second call from the cache', async () => {
    const scope = lastfm('track.getinfo', { artist: 'The Cure' }, 'lastfm/track.getinfo.a-forest.json');
    const first = await call();
    const second = await call();
    expect(first.status).toBe('ok');
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.body.track.name).toBe('A Forest');
    expect(scope.isDone()).toBe(true);
  });

  test('cache key ignores param order, case and surrounding whitespace', () => {
    const a = http.cacheKey('lastfm', '', { artist: ' The Cure', method: 'track.getinfo' });
    const b = http.cacheKey('lastfm', '', { method: 'TRACK.GETINFO', artist: 'the cure ' });
    expect(a).toBe(b);
  });

  test('expired entries are refetched once the TTL has passed', async () => {
    lastfm('track.getinfo', {}, 'lastfm/track.getinfo.a-forest.json');
    await call();
    const entry = http.loadCache()[Object.keys(http.loadCache())[0]];
    entry.fetchedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const scope = lastfm('track.getinfo', {}, 'lastfm/track.getinfo.a-forest.json');
    const again = await call();
    expect(again.fromCache).toBe(false);
    expect(scope.isDone()).toBe(true);
  });

  test('offline mode returns offline-miss without touching the network', async () => {
    process.env.NEXTTRACK_OFFLINE = '1';
    const scope = lastfm('track.getinfo', {}, 'lastfm/track.getinfo.a-forest.json');
    const result = await call();
    expect(result.status).toBe('offline-miss');
    expect(scope.isDone()).toBe(false);
  });

  test('offline mode still serves stale cache entries', async () => {
    lastfm('track.getinfo', {}, 'lastfm/track.getinfo.a-forest.json');
    await call();
    const entry = http.loadCache()[Object.keys(http.loadCache())[0]];
    entry.fetchedAt = 0;
    process.env.NEXTTRACK_OFFLINE = '1';
    const result = await call();
    expect(result.status).toBe('ok');
    expect(result.fromCache).toBe(true);
  });

  test('classifies a socket timeout as timeout', async () => {
    nock('https://ws.audioscrobbler.com').get('/2.0/').query(true).replyWithError({ code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' });
    const result = await call();
    expect(result.status).toBe('timeout');
  });

  test('classifies a 5xx as error and does not cache it', async () => {
    lastfm('track.getinfo', {}, { error: 'upstream down' }, 503);
    const result = await call();
    expect(result.status).toBe('error');
    expect(Object.keys(http.loadCache())).toHaveLength(0);
  });

  test('sends the identifying User-Agent to MusicBrainz', async () => {
    const scope = nock('https://musicbrainz.org', { reqheaders: { 'user-agent': http.USER_AGENT } })
      .get('/ws/2/artist/abc').query(true).reply(200, { id: 'abc' });
    const result = await http.request('musicbrainz', { path: 'artist/abc', params: { fmt: 'json' } });
    expect(result.body.id).toBe('abc');
    expect(scope.isDone()).toBe(true);
  });

  test('spaces MusicBrainz calls at least one second apart', async () => {
    http.configure({ rateLimit: true });
    nock('https://musicbrainz.org').get('/ws/2/artist/one').query(true).reply(200, {});
    nock('https://musicbrainz.org').get('/ws/2/artist/two').query(true).reply(200, {});
    const started = Date.now();
    await Promise.all([
      http.request('musicbrainz', { path: 'artist/one', params: {} }),
      http.request('musicbrainz', { path: 'artist/two', params: {} })
    ]);
    http.configure({ rateLimit: false });
    expect(Date.now() - started).toBeGreaterThanOrEqual(950);
  });

  test('per-request stats count hits, misses and upstream calls', async () => {
    lastfm('track.getinfo', {}, 'lastfm/track.getinfo.a-forest.json');
    const { stats } = await http.withRequestStats(async () => {
      await call();
      await call();
    });
    expect(stats).toMatchObject({ cacheHits: 1, cacheMisses: 1, upstreamCalls: 1 });
  });
});
