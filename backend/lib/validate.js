const { validationError } = require('./errors');
const { clampPoolSize } = require('./candidates');

const MAX_SEQUENCE = 10;
const MAX_NAME_LENGTH = 200;
const MAX_ALTERNATIVES = 10;
const DEFAULT_ALTERNATIVES = 5;

function isName(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_NAME_LENGTH;
}

// Out-of-range numbers are clamped rather than rejected, per the API contract
function clamp01(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function validateSequence(sequence, details) {
  if (!Array.isArray(sequence) || sequence.length === 0) {
    details.push('sequence must be a non-empty array of { artist, title } objects');
    return [];
  }
  if (sequence.length > MAX_SEQUENCE) details.push(`sequence may contain at most ${MAX_SEQUENCE} items`);
  sequence.forEach((item, i) => {
    if (!item || typeof item !== 'object') return details.push(`sequence[${i}] must be an object`);
    if (!isName(item.artist)) details.push(`sequence[${i}].artist must be a non-empty string of at most ${MAX_NAME_LENGTH} characters`);
    if (!isName(item.title)) details.push(`sequence[${i}].title must be a non-empty string of at most ${MAX_NAME_LENGTH} characters`);
    if (item.isrc !== undefined && typeof item.isrc !== 'string') details.push(`sequence[${i}].isrc must be a string when present`);
  });
  return sequence.map((item) => ({ artist: String(item.artist || '').trim(), title: String(item.title || '').trim(), isrc: item.isrc ? item.isrc.trim() : undefined }));
}

function validatePreferences(preferences, details) {
  const prefs = preferences && typeof preferences === 'object' ? preferences : {};
  if (prefs.targetGenre !== undefined && prefs.targetGenre !== null && typeof prefs.targetGenre !== 'string') details.push('preferences.targetGenre must be a string');
  const exclude = prefs.excludeArtists === undefined ? [] : prefs.excludeArtists;
  if (!Array.isArray(exclude) || exclude.some((a) => typeof a !== 'string')) details.push('preferences.excludeArtists must be an array of strings');
  return {
    genreStrictness: clamp01(prefs.genreStrictness, 0.5),
    discoveryFactor: clamp01(prefs.discoveryFactor, 0.5),
    targetGenre: typeof prefs.targetGenre === 'string' && prefs.targetGenre.trim() ? prefs.targetGenre.trim() : null,
    excludeArtists: Array.isArray(exclude) ? exclude.filter((a) => typeof a === 'string') : []
  };
}

function validateOptions(options, details) {
  const opts = options && typeof options === 'object' ? options : {};
  const poolMode = opts.poolMode === undefined ? 'dynamic' : opts.poolMode;
  if (poolMode !== 'dynamic' && poolMode !== 'fixed') details.push('options.poolMode must be "dynamic" or "fixed"');
  const alternatives = opts.alternatives === undefined ? DEFAULT_ALTERNATIVES : Number(opts.alternatives);
  return {
    poolMode,
    poolSize: clampPoolSize(opts.poolSize),
    alternatives: Number.isFinite(alternatives) ? Math.max(0, Math.min(MAX_ALTERNATIVES, Math.round(alternatives))) : DEFAULT_ALTERNATIVES
  };
}

function validateRecommendationRequest(body) {
  const details = [];
  const source = body && typeof body === 'object' ? body : {};
  const sequence = validateSequence(source.sequence, details);
  const preferences = validatePreferences(source.preferences, details);
  const options = validateOptions(source.options, details);
  if (details.length) throw validationError(details);
  return { sequence, preferences, options };
}

function validateBaselineRequest(body) {
  const details = [];
  const source = body && typeof body === 'object' ? body : {};
  const sequence = validateSequence(source.sequence, details);
  const options = validateOptions(source.options, details);
  const strategy = source.strategy === undefined ? 'random' : source.strategy;
  if (strategy !== 'random' && strategy !== 'popular') details.push('strategy must be "random" or "popular"');
  if (details.length) throw validationError(details);
  return { sequence, strategy, options, preferences: validatePreferences(source.preferences, []) };
}

module.exports = { validateRecommendationRequest, validateBaselineRequest, clamp01, MAX_SEQUENCE };
