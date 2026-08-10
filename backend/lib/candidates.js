const path = require('path');
const fs = require('fs');
const lastfm = require('./lastfm');
const { trackKey, sameName } = require('./reconcile');

const DEFAULT_POOL_SIZE = 40;
const MAX_POOL_SIZE = 80;
const MIN_DYNAMIC_POOL = 5;
const SIMILAR_TRACKS_PER_SEED = 20;
const SIMILAR_ARTISTS_PER_SEED = 5;
const TOP_TRACKS_PER_ARTIST = 5;
const FIXED_POOL = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'candidates.json'), 'utf8'));

function clampPoolSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_POOL_SIZE;
  return Math.max(1, Math.min(MAX_POOL_SIZE, Math.round(n)));
}

function noteFailure(failures, source, status) {
  if (status === 'timeout' || status === 'error') failures.push({ source, status });
}

// Similar tracks first, then top tracks of similar artists, both in Last.fm rank order
async function gatherForSeed(seed, failures) {
  const list = [];
  const similar = await lastfm.getSimilarTracks(seed.artist, seed.title, SIMILAR_TRACKS_PER_SEED);
  noteFailure(failures, 'lastfm', similar.status);
  for (const t of similar.tracks || []) list.push({ artist: t.artist, title: t.title, origin: 'similar-track' });
  const artists = await lastfm.getSimilarArtists(seed.artist, SIMILAR_ARTISTS_PER_SEED);
  noteFailure(failures, 'lastfm', artists.status);
  for (const a of artists.artists || []) {
    const top = await lastfm.getArtistTopTracks(a.name, TOP_TRACKS_PER_ARTIST);
    noteFailure(failures, 'lastfm', top.status);
    for (const t of top.tracks || []) list.push({ artist: t.artist, title: t.title, origin: 'similar-artist' });
  }
  return list;
}

// Round-robin across seeds so one seed with many neighbours cannot crowd the others out
function interleave(lists) {
  const merged = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i += 1) {
    for (const list of lists) if (list[i]) merged.push(list[i]);
  }
  return merged;
}

function isExcluded(candidate, excludeArtists) {
  return excludeArtists.some((name) => sameName(name, candidate.artist));
}

function dedupe(items, seeds, excludeArtists, cap) {
  const seen = new Set(seeds.map((s) => trackKey(s.artist, s.title)));
  const candidates = [];
  let excluded = 0;
  for (const item of items) {
    const key = trackKey(item.artist, item.title);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isExcluded(item, excludeArtists)) {
      excluded += 1;
      continue;
    }
    if (candidates.length < cap) candidates.push(item);
  }
  return { candidates, excluded };
}

function fixedPool(seeds, excludeArtists, cap, fallbackReason) {
  const items = FIXED_POOL.map((c) => ({ ...c, origin: 'fixed' }));
  return { mode: 'fixed', ...dedupe(items, seeds, excludeArtists, cap), fallbackReason, failures: [] };
}

// Returns { mode, candidates[], excluded, fallbackReason, failures[] }
async function buildPool({ seeds, poolMode = 'dynamic', poolSize, excludeArtists = [] }) {
  const cap = clampPoolSize(poolSize);
  if (poolMode === 'fixed') return fixedPool(seeds, excludeArtists, cap, null);
  const failures = [];
  const lists = [];
  for (const seed of [...seeds].reverse()) lists.push(await gatherForSeed(seed, failures));
  const { candidates, excluded } = dedupe(interleave(lists), seeds, excludeArtists, cap);
  if (candidates.length < MIN_DYNAMIC_POOL) {
    const reason = failures.length ? `dynamic pool unavailable (${failures[0].source} ${failures[0].status})` : `dynamic pool too small (${candidates.length})`;
    return { ...fixedPool(seeds, excludeArtists, cap, reason), failures };
  }
  return { mode: 'dynamic', candidates, excluded, fallbackReason: null, failures };
}

module.exports = { buildPool, clampPoolSize, DEFAULT_POOL_SIZE, MAX_POOL_SIZE, MIN_DYNAMIC_POOL, FIXED_POOL };
