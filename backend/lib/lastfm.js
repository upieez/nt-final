const http = require('./http');

const NOT_FOUND_CODE = 6;

// Returns { status, body } where status is ok, not-found, offline-miss, timeout or error
async function callLastfm(params) {
  const result = await http.request('lastfm', {
    params: { ...params, format: 'json', autocorrect: 1 },
    secretParams: { api_key: process.env.LASTFM_API_KEY }
  });
  if (result.status !== 'ok') return { status: result.status, message: result.message, body: null };
  const body = result.body || {};
  if (body.error === NOT_FOUND_CODE) return { status: 'not-found', body: null };
  if (body.error) return { status: 'error', message: body.message, body: null };
  return { status: 'ok', body };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function mapTags(raw) {
  return raw.map((t) => ({ name: t.name, weight: Number(t.count) || 0 }));
}

async function fetchTags(params) {
  const { status, message, body } = await callLastfm(params);
  if (status !== 'ok') return { tags: null, status, message };
  const raw = asArray(body.toptags?.tag);
  if (raw.length === 0) return { tags: [], status: 'no-tags' };
  return { tags: mapTags(raw), status: 'ok' };
}

function getTopTags(artist, title) {
  return fetchTags({ method: 'track.gettoptags', artist, track: title });
}

// Artist-level tags are the coverage backstop for the 54% no-tag rate seen at track level
function getArtistTopTags(artist) {
  return fetchTags({ method: 'artist.gettoptags', artist });
}

// Track tags first, artist tags as fallback; tagSource records which level was used
async function resolveTags(artist, title) {
  const trackResult = await getTopTags(artist, title);
  if (trackResult.status === 'ok') return { tags: trackResult.tags, status: 'ok', tagSource: 'track' };
  const artistResult = await getArtistTopTags(artist);
  if (artistResult.status === 'ok') {
    return { tags: artistResult.tags, status: 'ok', tagSource: 'artist', fallbackReason: trackResult.status };
  }
  return { tags: trackResult.tags, status: trackResult.status, tagSource: null, message: trackResult.message, artistStatus: artistResult.status };
}

function emptyMbid(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Autocorrected names and MBID hints feed reconciliation; listeners feed the popularity penalty
async function getTrackInfo(artist, title) {
  const { status, message, body } = await callLastfm({ method: 'track.getinfo', artist, track: title });
  if (status !== 'ok') return { listeners: null, status, message };
  const track = body.track || {};
  return {
    status: 'ok',
    listeners: Number(track.listeners) || 0,
    playcount: Number(track.playcount) || 0,
    correctedArtist: track.artist?.name || artist,
    correctedTitle: track.name || title,
    mbid: emptyMbid(track.mbid),
    artistMbid: emptyMbid(track.artist?.mbid)
  };
}

function mapSimilarTrack(t) {
  return { artist: t.artist?.name || '', title: t.name || '', match: Number(t.match) || 0, playcount: Number(t.playcount) || 0 };
}

async function getSimilarTracks(artist, title, limit = 20) {
  const { status, message, body } = await callLastfm({ method: 'track.getsimilar', artist, track: title, limit });
  if (status !== 'ok') return { tracks: null, status, message };
  return { tracks: asArray(body.similartracks?.track).map(mapSimilarTrack).filter((t) => t.artist && t.title), status: 'ok' };
}

async function getSimilarArtists(artist, limit = 5) {
  const { status, message, body } = await callLastfm({ method: 'artist.getsimilar', artist, limit });
  if (status !== 'ok') return { artists: null, status, message };
  return { artists: asArray(body.similarartists?.artist).map((a) => ({ name: a.name, match: Number(a.match) || 0 })), status: 'ok' };
}

function mapTopTrack(t) {
  return { artist: t.artist?.name || '', title: t.name || '', listeners: Number(t.listeners) || 0, playcount: Number(t.playcount) || 0 };
}

async function getArtistTopTracks(artist, limit = 5) {
  const { status, message, body } = await callLastfm({ method: 'artist.gettoptracks', artist, limit });
  if (status !== 'ok') return { tracks: null, status, message };
  return { tracks: asArray(body.toptracks?.track).map(mapTopTrack).filter((t) => t.artist && t.title), status: 'ok' };
}

// Tag charts carry no listener counts, so contrast candidates get their popularity from track.getInfo later
async function getTagTopTracks(tag, limit = 10) {
  const { status, message, body } = await callLastfm({ method: 'tag.gettoptracks', tag, limit });
  if (status !== 'ok') return { tracks: null, status, message };
  return { tracks: asArray(body.tracks?.track).map((t) => ({ artist: t.artist?.name || '', title: t.name || '' })).filter((t) => t.artist && t.title), status: 'ok' };
}

async function searchTracks(query, limit = 8) {
  const { status, message, body } = await callLastfm({ method: 'track.search', track: query, limit });
  if (status !== 'ok') return { results: null, status, message };
  const raw = asArray(body.results?.trackmatches?.track);
  return { results: raw.map((t) => ({ artist: t.artist, title: t.name, listeners: Number(t.listeners) || 0 })), status: 'ok' };
}

module.exports = {
  getTopTags,
  getArtistTopTags,
  resolveTags,
  getTrackInfo,
  getSimilarTracks,
  getSimilarArtists,
  getArtistTopTracks,
  getTagTopTracks,
  searchTracks
};
