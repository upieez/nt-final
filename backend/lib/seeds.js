const lastfm = require('./lastfm');
const { resolveTrack, resolveArtist } = require('./reconcile');
const { unresolvableError, upstreamError } = require('./errors');
const { ARTIST_TAG_CONFIDENCE } = require('./scoring');

const label = (t) => `${t.artist} - ${t.title}`;

// Artist entities are shared across seeds and candidates within one request
function artistMemo() {
  const memo = new Map();
  return (mbid) => {
    if (!mbid) return resolveArtist(null);
    if (!memo.has(mbid)) memo.set(mbid, resolveArtist(mbid));
    return memo.get(mbid);
  };
}

function unionGenres(...lists) {
  return [...new Set(lists.flat().filter(Boolean))];
}

function tagIssue(result) {
  return {
    'not-found': 'artist/track not found on Last.fm',
    timeout: 'Last.fm request timed out',
    'no-tags': 'no tags at track or artist level on Last.fm',
    'offline-miss': 'not in the offline cache'
  }[result.status] || result.message || 'Last.fm lookup failed';
}

// One seed: canonical ids, Last.fm tags with artist fallback, artist entity and merged genres
async function resolveSeed(item, getArtist) {
  const track = await resolveTrack(item, { full: true });
  const tagResult = await lastfm.resolveTags(item.artist, item.title);
  const artist = await getArtist(track.artistMbid);
  const tagsOk = tagResult.status === 'ok';
  return {
    input: item,
    track,
    artist,
    tags: tagsOk ? tagResult.tags : [],
    tagSource: tagsOk ? tagResult.tagSource : null,
    tagResult,
    confidence: tagResult.tagSource === 'artist' ? ARTIST_TAG_CONFIDENCE : 1,
    genres: unionGenres(track.recordingGenres, artist.genres),
    failures: [...track.failures, ...artist.failures],
    usable: tagsOk || track.recordingGenres.length > 0 || artist.genres.length > 0
  };
}

function seedWarnings(seed) {
  const warnings = [];
  const name = label(seed.input);
  if (seed.tagSource === 'artist') {
    warnings.push({ track: name, issue: `track-level tags unavailable (${seed.tagResult.fallbackReason}); used artist-level tags at ${ARTIST_TAG_CONFIDENCE} confidence` });
  } else if (seed.tagSource === null) {
    warnings.push({ track: name, issue: tagIssue(seed.tagResult) });
  }
  if (seed.track.matchedBy === 'none') warnings.push({ track: name, issue: 'no MusicBrainz recording matched; genre and graph signals unavailable for this seed' });
  return warnings;
}

function seedSummary(seed) {
  return {
    artist: seed.track.artist,
    title: seed.track.title,
    resolved: seed.usable,
    mbid: seed.track.mbid,
    tagSource: seed.tagSource
  };
}

// Pick the error class from what actually went wrong: timeout beats error beats plain not-found
function failureError(failures) {
  const timeout = failures.find((f) => f.status === 'timeout');
  if (timeout) return upstreamError(timeout);
  const error = failures.find((f) => f.status === 'error');
  return error ? upstreamError(error) : null;
}

async function resolveSeeds(sequence) {
  const getArtist = artistMemo();
  const seeds = [];
  const warnings = [];
  for (const item of sequence) {
    const seed = await resolveSeed(item, getArtist);
    seeds.push(seed);
    warnings.push(...seedWarnings(seed));
  }
  if (!seeds.some((s) => s.usable)) {
    const tagFailures = seeds.flatMap((s) => (['timeout', 'error'].includes(s.tagResult.status) ? [{ source: 'lastfm', status: s.tagResult.status }] : []));
    throw failureError([...tagFailures, ...seeds.flatMap((s) => s.failures)]) || unresolvableError('None of the supplied seed tracks could be resolved to tags or genres.', warnings);
  }
  return { seeds, warnings, getArtist };
}

module.exports = { resolveSeeds, seedSummary, failureError };
