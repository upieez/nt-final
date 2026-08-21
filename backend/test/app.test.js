const request = require('supertest');
const app = require('../app');

describe('app hardening', () => {
  test('health reports ok and the offline flag', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', offline: false });
  });

  test('security headers are set and the framework banner is hidden', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('cross-origin requests are allowed for the frontend', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  test('oversized JSON bodies are a 413', async () => {
    const res = await request(app).post('/api/v1/recommendations/next-track').send({ sequence: [{ artist: 'x'.repeat(40000), title: 'y' }] });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Request body too large' });
  });
});
