const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { recommend } = require('./recommend');
const { recommendBaseline } = require('./baseline');
const { validationError } = require('./errors');

const SYSTEMS = ['nexttrack', 'random', 'popular'];
const SLOTS = ['A', 'B', 'C'];
const DEV_SECRET = 'nexttrack-dev-secret-change-me';
const DEFAULT_RATINGS_FILE = path.join(__dirname, '..', '..', 'evaluation', 'ratings.jsonl');

function secret() {
  return process.env.STUDY_SECRET || DEV_SECRET;
}

function ratingsFile() {
  return process.env.RATINGS_FILE || DEFAULT_RATINGS_FILE;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

// The slot-to-system mapping lives only inside the signed id, so the server keeps no trial state
function encodeTrial(mapping) {
  const payload = Buffer.from(JSON.stringify({ mapping, issuedAt: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeTrial(trialId) {
  const [payload, signature] = String(trialId || '').split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
}

function shuffledSystems() {
  const systems = [...SYSTEMS];
  for (let i = systems.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [systems[i], systems[j]] = [systems[j], systems[i]];
  }
  return systems;
}

// Three recommendations over the same seeds, returned in a random slot order without system names
async function createTrial({ sequence, preferences, options }) {
  const results = {
    nexttrack: await recommend({ sequence, preferences, options }),
    random: await recommendBaseline({ sequence, strategy: 'random', options, preferences }),
    popular: await recommendBaseline({ sequence, strategy: 'popular', options, preferences })
  };
  const order = shuffledSystems();
  const mapping = {};
  const items = SLOTS.map((slot, i) => {
    mapping[slot] = { system: order[i], artist: results[order[i]].recommendation.artist, title: results[order[i]].recommendation.title };
    return { slot, artist: mapping[slot].artist, title: mapping[slot].title };
  });
  return { trialId: encodeTrial(mapping), items };
}

function isScale(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function validateRatings(ratings) {
  const details = [];
  if (!ratings || typeof ratings !== 'object') return ['ratings must be an object with keys A, B and C'];
  for (const slot of SLOTS) {
    const r = ratings[slot];
    if (!r || typeof r !== 'object') {
      details.push(`ratings.${slot} is required`);
      continue;
    }
    if (!isScale(r.coherence)) details.push(`ratings.${slot}.coherence must be an integer from 1 to 5`);
    if (!isScale(r.novelty)) details.push(`ratings.${slot}.novelty must be an integer from 1 to 5`);
    if (typeof r.wouldPlay !== 'boolean') details.push(`ratings.${slot}.wouldPlay must be a boolean`);
  }
  return details;
}

// Appends one anonymous line: system, track and the three ratings, nothing about the rater
function recordRatings({ trialId, ratings }) {
  const trial = decodeTrial(trialId);
  const details = trial ? validateRatings(ratings) : ['trialId is missing or has an invalid signature'];
  if (details.length) throw validationError(details);
  const line = {
    ratedAt: new Date().toISOString(),
    results: SLOTS.map((slot) => ({
      system: trial.mapping[slot].system,
      artist: trial.mapping[slot].artist,
      title: trial.mapping[slot].title,
      coherence: ratings[slot].coherence,
      novelty: ratings[slot].novelty,
      wouldPlay: ratings[slot].wouldPlay
    }))
  };
  fs.mkdirSync(path.dirname(ratingsFile()), { recursive: true });
  fs.appendFileSync(ratingsFile(), `${JSON.stringify(line)}\n`);
  return { ok: true };
}

module.exports = { createTrial, recordRatings, encodeTrial, decodeTrial };
