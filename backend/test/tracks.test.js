const request = require('supertest');
const http = require('../lib/http');
const app = require('../app');
const { lastfm, nock } = require('./helpers/upstream');

beforeEach(() => {
  http.resetCache();
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
