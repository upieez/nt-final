export const DEFAULT_PREFERENCES = {
  genreStrictness: 0.5,
  discoveryFactor: 0.5,
  targetGenre: '',
  excludeArtists: []
};

export const DEFAULT_OPTIONS = {
  poolMode: 'dynamic',
  poolSize: 40,
  alternatives: 5
};

export function clamp01(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export function addExcludedArtist(list, name) {
  const clean = name.trim();
  if (!clean) return list;
  if (list.some((a) => a.toLowerCase() === clean.toLowerCase())) return list;
  return [...list, clean];
}

export function buildRequest(sequence, preferences, options) {
  const prefs = {
    genreStrictness: clamp01(preferences.genreStrictness),
    discoveryFactor: clamp01(preferences.discoveryFactor)
  };
  if (preferences.targetGenre.trim()) prefs.targetGenre = preferences.targetGenre.trim();
  if (preferences.excludeArtists.length > 0) prefs.excludeArtists = preferences.excludeArtists;
  return { sequence, preferences: prefs, options: { ...options } };
}
