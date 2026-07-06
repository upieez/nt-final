const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const axios = require('axios');

const TIMEOUT_MS = 5000;
const DEFAULT_TTL_DAYS = 30;
const DEFAULT_CACHE_FILE = path.join(__dirname, '..', 'data', 'cache', 'snapshot.json');
const USER_AGENT = 'NextTrack/1.0 (samuelhww@gmail.com)';

// One entry per upstream: base URL, minimum spacing between calls, fixed headers
const SOURCES = {
  lastfm: { baseUrl: 'https://ws.audioscrobbler.com/2.0/', minIntervalMs: 200, headers: { 'User-Agent': USER_AGENT } },
  musicbrainz: { baseUrl: 'https://musicbrainz.org/ws/2/', minIntervalMs: 1000, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
  wikidata: { baseUrl: 'https://query.wikidata.org/sparql', minIntervalMs: 500, headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' } }
};

const settings = { rateLimit: true, persist: true };
const requestContext = new AsyncLocalStorage();
const limiterState = {};
let cache = null;
let flushTimer = null;

function cacheFile() {
  return process.env.NEXTTRACK_CACHE_FILE || DEFAULT_CACHE_FILE;
}

function ttlMs() {
  const days = Number(process.env.NEXTTRACK_CACHE_TTL_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000;
}

function isOffline() {
  return process.env.NEXTTRACK_OFFLINE === '1';
}

function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
  } catch (err) {
    cache = {};
  }
  return cache;
}

function flushCache() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (!settings.persist || !cache) return;
  const file = cacheFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cache));
}

function scheduleFlush() {
  if (flushTimer || !settings.persist) return;
  flushTimer = setTimeout(flushCache, 250);
  flushTimer.unref();
}

function resetCache() {
  cache = {};
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}

function normaliseValue(value) {
  if (typeof value === 'string') return value.trim().toLowerCase();
  return value;
}

// Keys are stable across param order and case so repeat lookups hit the same entry
function cacheKey(source, urlPath, params) {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${encodeURIComponent(normaliseValue(params[k]))}`);
  return `${source}:${urlPath}:${sorted.join('&')}`;
}

function readCache(key) {
  const entry = loadCache()[key];
  if (!entry) return null;
  const fresh = Date.now() - entry.fetchedAt < ttlMs();
  if (!fresh && !isOffline()) return null;
  return entry;
}

function writeCache(key, httpStatus, body) {
  loadCache()[key] = { fetchedAt: Date.now(), httpStatus, body };
  scheduleFlush();
}

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

// Each source has its own queue so a slow MusicBrainz call never delays Last.fm
function acquireSlot(source) {
  if (!settings.rateLimit) return Promise.resolve();
  const state = limiterState[source] || (limiterState[source] = { nextAt: 0 });
  const now = Date.now();
  const startAt = Math.max(now, state.nextAt);
  state.nextAt = startAt + SOURCES[source].minIntervalMs;
  return sleep(startAt - now);
}

function currentStats() {
  return requestContext.getStore();
}

function count(field) {
  const stats = currentStats();
  if (stats) stats[field] += 1;
}

function classifyFailure(err) {
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) return { status: 'timeout' };
  return { status: 'error', message: err.message };
}

async function callNetwork(source, urlPath, params, secretParams) {
  const config = SOURCES[source];
  const response = await axios.get(config.baseUrl + urlPath, {
    params: { ...params, ...secretParams },
    headers: config.headers,
    timeout: TIMEOUT_MS,
    validateStatus: () => true
  });
  return { httpStatus: response.status, body: response.data };
}

// Returns { status: ok | offline-miss | timeout | error, body, httpStatus, fromCache, source }
async function request(source, { path: urlPath = '', params = {}, secretParams = {} }) {
  if (!SOURCES[source]) throw new Error(`Unknown source: ${source}`);
  const key = cacheKey(source, urlPath, params);
  const cached = readCache(key);
  if (cached) {
    count('cacheHits');
    return { status: 'ok', body: cached.body, httpStatus: cached.httpStatus, fromCache: true, source };
  }
  count('cacheMisses');
  if (isOffline()) return { status: 'offline-miss', body: null, fromCache: false, source };
  await acquireSlot(source);
  count('upstreamCalls');
  try {
    const { httpStatus, body } = await callNetwork(source, urlPath, params, secretParams);
    if (httpStatus >= 500 || httpStatus === 429) {
      return { status: 'error', message: `HTTP ${httpStatus} from ${source}`, httpStatus, body, fromCache: false, source };
    }
    writeCache(key, httpStatus, body);
    return { status: 'ok', body, httpStatus, fromCache: false, source };
  } catch (err) {
    return { ...classifyFailure(err), body: null, fromCache: false, source };
  }
}

function newStats() {
  return { cacheHits: 0, cacheMisses: 0, upstreamCalls: 0, matchAttempted: 0, matchResolved: 0 };
}

// Runs fn with a fresh per-request counter set reachable from any nested call
async function withRequestStats(fn) {
  const stats = newStats();
  const result = await requestContext.run(stats, fn);
  return { result, stats };
}

function configure(overrides) {
  Object.assign(settings, overrides);
}

module.exports = {
  SOURCES,
  TIMEOUT_MS,
  USER_AGENT,
  request,
  cacheKey,
  isOffline,
  withRequestStats,
  currentStats,
  count,
  configure,
  flushCache,
  resetCache,
  loadCache
};
