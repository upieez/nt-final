const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const http = require('../lib/http');
const app = require('../app');
const { encodeTrial, decodeTrial } = require('../lib/study');
const world = require('./helpers/world');
const { nock } = require('./helpers/upstream');

const SEQUENCE = [{ artist: 'Joy Division', title: 'Disorder' }, { artist: 'The Cure', title: 'A Forest' }];
const ratings = { A: { coherence: 4, novelty: 2, wouldPlay: true }, B: { coherence: 1, novelty: 5, wouldPlay: false }, C: { coherence: 3, novelty: 3, wouldPlay: true } };

beforeEach(() => {
  http.resetCache();
  nock.cleanAll();
  world.install();
  process.env.RATINGS_FILE = path.join(os.tmpdir(), `nexttrack-ratings-${process.pid}-${Date.now()}.jsonl`);
});

describe('study endpoints', () => {
  test('compare returns three shuffled slots with a signed trial id and no system names', async () => {
    const res = await request(app).post('/api/v1/study/compare').send({ sequence: SEQUENCE, preferences: { discoveryFactor: 0.5 } });
    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i.slot)).toEqual(['A', 'B', 'C']);
    for (const item of res.body.items) expect(Object.keys(item).sort()).toEqual(['artist', 'image', 'slot', 'title']);
    const trial = decodeTrial(res.body.trialId);
    expect(Object.values(trial.mapping).map((m) => m.system).sort()).toEqual(['nexttrack', 'popular', 'random']);
    expect(Object.values(trial.mapping).find((m) => m.system === 'nexttrack').title).toBe('Spellbound');
  });

  test('rate appends one anonymous line keyed by system', async () => {
    const trialId = encodeTrial({ A: { system: 'random', artist: 'X', title: 'x' }, B: { system: 'nexttrack', artist: 'Y', title: 'y' }, C: { system: 'popular', artist: 'Z', title: 'z' } });
    const res = await request(app).post('/api/v1/study/rate').send({ trialId, ratings });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const lines = fs.readFileSync(process.env.RATINGS_FILE, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]);
    expect(Object.keys(line).sort()).toEqual(['ratedAt', 'results']);
    expect(line.results[1]).toEqual({ system: 'nexttrack', artist: 'Y', title: 'y', coherence: 1, novelty: 5, wouldPlay: false });
  });

  test('a tampered trial id is rejected', async () => {
    const trialId = encodeTrial({ A: { system: 'random' }, B: { system: 'nexttrack' }, C: { system: 'popular' } });
    const [payload] = trialId.split('.');
    const res = await request(app).post('/api/v1/study/rate').send({ trialId: `${payload}.forged`, ratings });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['trialId is missing or has an invalid signature']);
    expect(fs.existsSync(process.env.RATINGS_FILE)).toBe(false);
  });

  test('ratings outside the scale are rejected with details', async () => {
    const trialId = encodeTrial({ A: { system: 'random' }, B: { system: 'nexttrack' }, C: { system: 'popular' } });
    const res = await request(app).post('/api/v1/study/rate').send({ trialId, ratings: { ...ratings, C: { coherence: 9, novelty: 3, wouldPlay: 'yes' } } });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['ratings.C.coherence must be an integer from 1 to 5', 'ratings.C.wouldPlay must be a boolean']);
  });
});
