const http = require('./http');

const SEARCH_LIMIT = 5;
const WIKIDATA_URL = /wikidata\.org\/wiki\/(Q\d+)/;

// Returns { status, body } where status is ok, not-found, offline-miss, timeout or error
async function callMusicbrainz(urlPath, params) {
  const result = await http.request('musicbrainz', { path: urlPath, params: { ...params, fmt: 'json' } });
  if (result.status !== 'ok') return { status: result.status, message: result.message, body: null };
  if (result.httpStatus === 404) return { status: 'not-found', body: null };
  if (result.httpStatus >= 400) return { status: 'error', message: result.body?.error || `HTTP ${result.httpStatus}`, body: null };
  return { status: 'ok', body: result.body || {} };
}

function luceneQuote(value) {
  return `"${String(value).replace(/["\\]/g, ' ')}"`;
}

function creditedArtist(recording) {
  const credit = Array.isArray(recording['artist-credit']) ? recording['artist-credit'][0] : null;
  if (!credit) return { artistName: null, artistMbid: null };
  return { artistName: credit.artist?.name || credit.name || null, artistMbid: credit.artist?.id || null };
}

function namedList(items) {
  return (Array.isArray(items) ? items : []).map((g) => ({ name: g.name, count: Number(g.count) || 0 })).filter((g) => g.name);
}

function mapRecording(recording) {
  return {
    mbid: recording.id,
    title: recording.title,
    score: Number(recording.score) || 0,
    isrcs: Array.isArray(recording.isrcs) ? recording.isrcs : [],
    genres: namedList(recording.genres),
    tags: namedList(recording.tags),
    ...creditedArtist(recording)
  };
}

// Recording search by artist and title, ranked by the MusicBrainz relevance score (0-100)
async function searchRecording(artist, title, limit = SEARCH_LIMIT) {
  const query = `artist:${luceneQuote(artist)} AND recording:${luceneQuote(title)}`;
  const { status, message, body } = await callMusicbrainz('recording', { query, limit });
  if (status !== 'ok') return { recordings: null, status, message };
  return { recordings: (body.recordings || []).map(mapRecording), status: 'ok' };
}

async function getRecording(mbid) {
  const { status, message, body } = await callMusicbrainz(`recording/${mbid}`, { inc: 'artist-credits+isrcs+genres+tags' });
  if (status !== 'ok') return { recording: null, status, message };
  return { recording: mapRecording(body), status: 'ok' };
}

async function getRecordingsByIsrc(isrc) {
  const { status, message, body } = await callMusicbrainz(`isrc/${encodeURIComponent(isrc)}`, { inc: 'artist-credits' });
  if (status !== 'ok') return { recordings: null, status, message };
  return { recordings: (body.recordings || []).map(mapRecording), status: 'ok' };
}

function wikidataIdFromRelations(relations) {
  for (const rel of Array.isArray(relations) ? relations : []) {
    const match = WIKIDATA_URL.exec(rel.url?.resource || '');
    if (rel.type === 'wikidata' && match) return match[1];
  }
  return null;
}

// Artist genres, country and the Wikidata link that unlocks the graph signal
async function getArtist(mbid) {
  const { status, message, body } = await callMusicbrainz(`artist/${mbid}`, { inc: 'genres+tags+url-rels' });
  if (status !== 'ok') return { artist: null, status, message };
  return {
    status: 'ok',
    artist: {
      mbid: body.id,
      name: body.name,
      type: body.type || null,
      country: body.country || null,
      genres: namedList(body.genres),
      tags: namedList(body.tags),
      wikidataId: wikidataIdFromRelations(body.relations)
    }
  };
}

module.exports = { searchRecording, getRecording, getRecordingsByIsrc, getArtist, luceneQuote };
