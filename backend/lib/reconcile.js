const http = require('./http');
const lastfm = require('./lastfm');
const musicbrainz = require('./musicbrainz');
const wikidata = require('./wikidata');

const NORMALISED_CONFIDENCE = 0.9;
const ISRC_CONFIDENCE = 0.8;
const FEATURING = /[([]?\s*\b(feat|ft|featuring)\.?\s.*$/;
const NOISE_WORDS = '(remaster(ed)?|live|remix|mix|version|edit|mono|stereo|demo|deluxe|bonus|acoustic|instrumental|radio|explicit|clean|anniversary|\\d{4})';
const BRACKETED_NOISE = new RegExp(`\\s*[([][^)\\]]*\\b${NOISE_WORDS}\\b[^)\\]]*[)\\]]`, 'g');
const DASHED_NOISE = new RegExp(`\\s+-\\s+[^-]*\\b${NOISE_WORDS}\\b.*$`);
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const APOSTROPHES = /['\u2019]/g;

function stripDiacritics(value) {
  return value.normalize('NFKD').replace(COMBINING_MARKS, '');
}

// Canonical form used for cross-source matching and de-duplication, never shown to users
function normaliseName(value, { keepThe = false } = {}) {
  if (typeof value !== 'string') return '';
  let name = stripDiacritics(value.toLowerCase());
  name = name.replace(FEATURING, '');
  name = name.replace(BRACKETED_NOISE, '').replace(DASHED_NOISE, '');
  name = name.replace(APOSTROPHES, '').replace(/&/g, ' and ');
  name = name.replace(/[^a-z0-9]+/g, ' ').trim();
  if (!keepThe && name.startsWith('the ') && name !== 'the the') name = name.slice(4);
  return name;
}

function trackKey(artist, title) {
  return `${normaliseName(artist)}|${normaliseName(title)}`;
}

function sameName(a, b) {
  return normaliseName(a) === normaliseName(b) && normaliseName(a) !== '';
}

function exactName(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();
}

function scoreFactor(recording) {
  return Math.max(0, Math.min(100, recording.score || 0)) / 100;
}

function shareIsrc(a, b) {
  return (a || []).some((code) => (b || []).includes(code));
}

// Picks the best MusicBrainz hit: exact names, then normalised names, in search-score order
function pickByName(recordings, names) {
  for (const rec of recordings) {
    const artistOk = names.some((n) => exactName(rec.artistName, n.artist));
    const titleOk = names.some((n) => exactName(rec.title, n.title));
    if (artistOk && titleOk) return { recording: rec, matchedBy: 'exact', matchConfidence: scoreFactor(rec) };
  }
  for (const rec of recordings) {
    const artistOk = names.some((n) => sameName(rec.artistName, n.artist));
    const titleOk = names.some((n) => sameName(rec.title, n.title));
    if (artistOk && titleOk) return { recording: rec, matchedBy: 'normalised', matchConfidence: NORMALISED_CONFIDENCE * scoreFactor(rec) };
  }
  return null;
}

// Cross-check: the recording Last.fm points at and the search hit both carry an ISRC
async function pickByIsrc(recordings, lastfmMbid, failures) {
  if (!lastfmMbid || recordings.length === 0) return null;
  const hinted = await musicbrainz.getRecording(lastfmMbid);
  noteFailure(failures, 'musicbrainz', hinted.status);
  if (hinted.status !== 'ok') return null;
  const top = recordings[0];
  if (!shareIsrc(hinted.recording.isrcs, top.isrcs)) return null;
  return { recording: top, matchedBy: 'isrc', matchConfidence: ISRC_CONFIDENCE * scoreFactor(top) };
}

function noteFailure(failures, source, status) {
  if (status === 'timeout' || status === 'error') failures.push({ source, status });
}

function unresolved(input, info, failures) {
  return {
    artist: info.correctedArtist || input.artist,
    title: info.correctedTitle || input.title,
    mbid: null,
    artistMbid: info.artistMbid || null,
    wikidataId: null,
    isrc: [],
    matchConfidence: 0,
    matchedBy: 'none',
    listeners: info.listeners ?? null,
    recordingGenres: [],
    failures
  };
}

async function lookupByIsrc(isrc, failures) {
  const result = await musicbrainz.getRecordingsByIsrc(isrc);
  noteFailure(failures, 'musicbrainz', result.status);
  if (result.status !== 'ok' || result.recordings.length === 0) return null;
  return { recording: result.recordings[0], matchedBy: 'isrc', matchConfidence: ISRC_CONFIDENCE };
}

async function findRecording(input, info, failures) {
  if (input.isrc) {
    const byIsrc = await lookupByIsrc(input.isrc, failures);
    if (byIsrc) return byIsrc;
  }
  const names = [input, { artist: info.correctedArtist, title: info.correctedTitle }];
  const search = await musicbrainz.searchRecording(names[1].artist || input.artist, names[1].title || input.title);
  noteFailure(failures, 'musicbrainz', search.status);
  if (search.status !== 'ok') return null;
  return pickByName(search.recordings, names) || pickByIsrc(search.recordings, info.mbid, failures);
}

// Seeds get the full recording lookup so their ISRCs and MusicBrainz genres are complete
async function completeRecording(match, full, failures) {
  if (!full) return match.recording;
  const result = await musicbrainz.getRecording(match.recording.mbid);
  noteFailure(failures, 'musicbrainz', result.status);
  return result.status === 'ok' ? result.recording : match.recording;
}

// Resolves { artist, title, isrc? } to canonical ids; matchedBy is exact, normalised, isrc or none
async function resolveTrack(input, { full = false } = {}) {
  http.count('matchAttempted');
  const failures = [];
  const infoResult = await lastfm.getTrackInfo(input.artist, input.title);
  noteFailure(failures, 'lastfm', infoResult.status);
  const info = infoResult.status === 'ok' ? infoResult : {};
  const match = await findRecording(input, info, failures);
  if (!match) return unresolved(input, info, failures);
  http.count('matchResolved');
  const recording = await completeRecording(match, full, failures);
  return {
    artist: recording.artistName || info.correctedArtist || input.artist,
    title: recording.title || info.correctedTitle || input.title,
    mbid: recording.mbid,
    artistMbid: recording.artistMbid || info.artistMbid || null,
    wikidataId: null,
    isrc: recording.isrcs,
    matchConfidence: Number(match.matchConfidence.toFixed(3)),
    matchedBy: match.matchedBy,
    listeners: info.listeners ?? null,
    recordingGenres: recording.genres.map((g) => g.name),
    failures
  };
}

async function findWikidataId(artist, failures) {
  if (artist.wikidataId) return artist.wikidataId;
  const found = await wikidata.findArtistByMbid(artist.mbid);
  noteFailure(failures, 'wikidata', found.status);
  return found.qid;
}

function emptyArtist(artistMbid) {
  return { mbid: artistMbid, name: null, country: null, genres: [], wikidataId: null, labels: [], members: [], memberOf: [], failures: [] };
}

// Artist entity = MusicBrainz artist plus Wikidata relations, the inputs to genre and graph signals
async function resolveArtist(artistMbid) {
  const entity = emptyArtist(artistMbid);
  if (!artistMbid) return entity;
  const mb = await musicbrainz.getArtist(artistMbid);
  noteFailure(entity.failures, 'musicbrainz', mb.status);
  if (mb.status !== 'ok') return entity;
  Object.assign(entity, { name: mb.artist.name, country: mb.artist.country, genres: mb.artist.genres.map((g) => g.name), wikidataId: mb.artist.wikidataId });
  entity.wikidataId = await findWikidataId(mb.artist, entity.failures);
  if (!entity.wikidataId) return entity;
  const wd = await wikidata.getArtistRelations(entity.wikidataId);
  noteFailure(entity.failures, 'wikidata', wd.status);
  if (wd.status !== 'ok') return entity;
  entity.labels = wd.relations.labels;
  entity.members = wd.relations.members;
  entity.memberOf = wd.relations.memberOf;
  entity.country = entity.country || wd.relations.country;
  for (const genre of wd.relations.genres) if (!entity.genres.includes(genre)) entity.genres.push(genre);
  return entity;
}

function matchRate(stats) {
  if (!stats || !stats.matchAttempted) return null;
  return Number((stats.matchResolved / stats.matchAttempted).toFixed(3));
}

module.exports = { normaliseName, trackKey, sameName, resolveTrack, resolveArtist, matchRate };
