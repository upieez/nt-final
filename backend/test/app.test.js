const request = require('supertest');
const app = require('../app');

describe('health', () => {
  test('reports ok and the offline flag', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', offline: false });
  });
});
