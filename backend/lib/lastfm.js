const axios = require('axios');

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
const TIMEOUT_MS = 5000;

async function callLastfm(params) {
  const response = await axios.get(BASE_URL, {
    params: { ...params, api_key: process.env.LASTFM_API_KEY, format: 'json', autocorrect: 1 },
    timeout: TIMEOUT_MS
  });
  return response.data;
}

function classifyError(err) {
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) return { status: 'timeout' };
  return { status: 'error', message: err.message };
}

// Returns { tags, status } where status is ok, no-tags, not-found, timeout or error
async function getTopTags(artist, title) {
  try {
    const data = await callLastfm({ method: 'track.gettoptags', artist, track: title });
    if (data.error) {
      if (data.error === 6) return { tags: null, status: 'not-found' };
      return { tags: null, status: 'error', message: data.message };
    }
    const raw = Array.isArray(data.toptags?.tag) ? data.toptags.tag : [];
    if (raw.length === 0) return { tags: [], status: 'no-tags' };
    return { tags: raw.map((t) => ({ name: t.name, weight: Number(t.count) || 0 })), status: 'ok' };
  } catch (err) {
    return { tags: null, ...classifyError(err) };
  }
}

// Listener count is the popularity signal for discoveryFactor and tie-breaks
async function getTrackInfo(artist, title) {
  try {
    const data = await callLastfm({ method: 'track.getinfo', artist, track: title });
    if (data.error) {
      if (data.error === 6) return { listeners: null, status: 'not-found' };
      return { listeners: null, status: 'error', message: data.message };
    }
    return { listeners: Number(data.track?.listeners) || 0, status: 'ok' };
  } catch (err) {
    return { listeners: null, ...classifyError(err) };
  }
}

// Artist-level tags are the coverage backstop for the 54% no-tag rate seen at track level
async function getArtistTopTags(artist) {
  try {
    const data = await callLastfm({ method: 'artist.gettoptags', artist });
    if (data.error) {
      if (data.error === 6) return { tags: null, status: 'not-found' };
      return { tags: null, status: 'error', message: data.message };
    }
    const raw = Array.isArray(data.toptags?.tag) ? data.toptags.tag : [];
    if (raw.length === 0) return { tags: [], status: 'no-tags' };
    return { tags: raw.map((t) => ({ name: t.name, weight: Number(t.count) || 0 })), status: 'ok' };
  } catch (err) {
    return { tags: null, ...classifyError(err) };
  }
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

module.exports = { getTopTags, getArtistTopTags, resolveTags, getTrackInfo };
