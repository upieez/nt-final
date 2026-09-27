const axios = require("axios");

const RESULTS_URL = "https://www.youtube.com/results";
const TIMEOUT_MS = 5000;
const MAX_ENTRIES = 500;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const cache = new Map();

function remember(key, value) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

function searchQuery(track) {
  return `${track.artist} ${track.title}`.trim();
}

function searchUrl(track) {
  return `${RESULTS_URL}?search_query=${encodeURIComponent(searchQuery(track))}`;
}

// First videoId is top hit
function firstVideoId(html) {
  const match = /"videoId":"([A-Za-z0-9_-]{11})"/.exec(String(html || ""));
  return match ? match[1] : null;
}

async function findVideo(track) {
  const key = searchQuery(track).toLowerCase();
  if (cache.has(key)) return cache.get(key);
  try {
    const response = await axios.get(RESULTS_URL, {
      params: { search_query: searchQuery(track), hl: "en" },
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      timeout: TIMEOUT_MS,
      responseType: "text",
      validateStatus: () => true,
    });
    if (response.status >= 400) return { status: "error", videoId: null };
    return remember(key, {
      status: "ok",
      videoId: firstVideoId(response.data),
    });
  } catch (err) {
    return {
      status: /timeout/i.test(err.message || "") ? "timeout" : "error",
      videoId: null,
    };
  }
}

function resetCache() {
  cache.clear();
}

module.exports = { findVideo, firstVideoId, searchUrl, resetCache };
