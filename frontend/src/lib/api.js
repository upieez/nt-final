export class ApiError extends Error {
  constructor(status, body) {
    super(body && body.error ? body.error : `Request failed with status ${status}`);
    this.status = status;
    this.body = body || {};
  }
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...options
    });
  } catch (err) {
    throw new ApiError(0, { error: err.message });
  }
  const body = await parseBody(response);
  if (!response.ok) throw new ApiError(response.status, body);
  return body;
}

export function searchTracks(query, signal) {
  const q = encodeURIComponent(query);
  return request(`/api/v1/tracks/search?q=${q}`, { signal });
}

export function getTrackInfo(track, signal) {
  const artist = encodeURIComponent(track.artist);
  const title = encodeURIComponent(track.title);
  return request(`/api/v1/tracks/info?artist=${artist}&title=${title}`, { signal });
}

export function getVideo(track, signal) {
  const artist = encodeURIComponent(track.artist);
  const title = encodeURIComponent(track.title);
  return request(`/api/v1/tracks/video?artist=${artist}&title=${title}`, { signal });
}

export function getHealth() {
  return request('/health');
}

export function postJson(path, payload) {
  return request(path, { method: 'POST', body: JSON.stringify(payload) });
}
