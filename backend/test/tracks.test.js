const request = require('supertest');
const http = require('../lib/http');
const app = require('../app');
const youtube = require('../lib/youtube');
const { lastfm, nock, fixture } = require('./helpers/upstream');

beforeEach(() => {
  http.resetCache();
  youtube.resetCache();
  nock.cleanAll();
});

describe('GET /api/v1/tracks/search', () => {
  test('returns up to eight Last.fm matches', async () => {
    lastfm('track.search', { track: 'forest', limit: 8 }, 'lastfm/track.search.forest.json');
    const res = await request(app).get('/api/v1/tracks/search').query({ q: 'forest' });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results[0]).toEqual({ artist: 'The Cure', title: 'A Forest', listeners: 812345 });
  });

  test('missing query is a 400', async () => {
    const res = await request(app).get('/api/v1/tracks/search');
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['q must be a non-empty string']);
  });

  test('upstream failure is a 502', async () => {
    lastfm('track.search', {}, { error: 'down' }, 503);
    const res = await request(app).get('/api/v1/tracks/search').query({ q: 'forest' });
    expect(res.status).toBe(502);
    expect(res.body.source).toBe('lastfm');
  });
});

describe('GET /api/v1/tracks/info', () => {
  test('returns corrected names and the largest album image', async () => {
    const body = fixture('lastfm/track.getinfo.a-forest.json');
    body.track.album.image = [
      { '#text': 'https://img.example/34.png', size: 'small' },
      { '#text': 'https://img.example/300.png', size: 'extralarge' }
    ];
    lastfm('track.getinfo', { artist: 'the cure', track: 'a forest' }, body);
    const res = await request(app).get('/api/v1/tracks/info').query({ artist: 'the cure', title: 'a forest' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ artist: 'The Cure', title: 'A Forest', found: true, image: 'https://img.example/300.png', album: 'Seventeen Seconds', listeners: 812345 });
  });

  test('empty image strings mean no art', async () => {
    const body = fixture('lastfm/track.getinfo.a-forest.json');
    body.track.album.image = [{ '#text': '', size: 'extralarge' }];
    lastfm('track.getinfo', { artist: 'the cure' }, body);
    const res = await request(app).get('/api/v1/tracks/info').query({ artist: 'The Cure', title: 'A Forest' });
    expect(res.body.image).toBeNull();
  });

  test('unknown track is found: false, not an error', async () => {
    lastfm('track.getinfo', {}, 'lastfm/error.not-found.json');
    const res = await request(app).get('/api/v1/tracks/info').query({ artist: 'Nobody', title: 'Nothing' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ artist: 'Nobody', title: 'Nothing', found: false, image: null, album: null, listeners: null });
  });

  test('missing fields are a 400', async () => {
    const res = await request(app).get('/api/v1/tracks/info').query({ artist: 'The Cure' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['title must be a non-empty string']);
  });
});

describe('GET /api/v1/tracks/video', () => {
  const page = '<html><script>var ytInitialData = {"contents":[{"videoRenderer":{"videoId":"kkASIx9Xk6s"}},{"videoRenderer":{"videoId":"zzzzzzzzzzz"}}]}</script></html>';

  test('returns the first video id on the results page and a search link', async () => {
    nock('https://www.youtube.com').get('/results').query((q) => q.search_query === 'New Order Ceremony').reply(200, page);
    const res = await request(app).get('/api/v1/tracks/video').query({ artist: 'New Order', title: 'Ceremony' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ videoId: 'kkASIx9Xk6s', searchUrl: 'https://www.youtube.com/results?search_query=New%20Order%20Ceremony' });
  });

  test('a page without ids gives videoId null, still with the search link', async () => {
    nock('https://www.youtube.com').get('/results').query(true).reply(200, '<html>consent</html>');
    const res = await request(app).get('/api/v1/tracks/video').query({ artist: 'Nobody', title: 'Nothing' });
    expect(res.status).toBe(200);
    expect(res.body.videoId).toBeNull();
    expect(res.body.searchUrl).toContain('Nobody%20Nothing');
  });

  test('a second lookup is served from memory', async () => {
    nock('https://www.youtube.com').get('/results').query(true).once().reply(200, page);
    await request(app).get('/api/v1/tracks/video').query({ artist: 'New Order', title: 'Ceremony' });
    const res = await request(app).get('/api/v1/tracks/video').query({ artist: 'new order', title: 'ceremony' });
    expect(res.body.videoId).toBe('kkASIx9Xk6s');
  });

  test('missing fields are a 400', async () => {
    const res = await request(app).get('/api/v1/tracks/video').query({ title: 'Ceremony' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['artist must be a non-empty string']);
  });
});
