export const DEFAULT_PREFERENCES = {
  divergence: 0,
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

export const DIVERGENCE_THRESHOLD = 0.5;

export function clamp01(value, fallback = 0.5) {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

// Similarity mirrors divergence
export function similarityFrom(divergence) {
  return Number((1 - clamp01(divergence, 0)).toFixed(2));
}

export function divergenceFrom(similarity) {
  return Number((1 - clamp01(similarity, 1)).toFixed(2));
}

export function addExcludedArtist(list, name) {
  const clean = name.trim();
  if (!clean) return list;
  if (list.some((a) => a.toLowerCase() === clean.toLowerCase())) return list;
  return [...list, clean];
}

export function buildRequest(sequence, preferences, options) {
  const prefs = {
    divergence: clamp01(preferences.divergence, 0),
    genreStrictness: clamp01(preferences.genreStrictness),
    discoveryFactor: clamp01(preferences.discoveryFactor)
  };
  if (preferences.targetGenre.trim()) prefs.targetGenre = preferences.targetGenre.trim();
  if (preferences.excludeArtists.length > 0) prefs.excludeArtists = preferences.excludeArtists;
  return { sequence: sequence.map((t) => ({ artist: t.artist, title: t.title })), preferences: prefs, options: { ...options } };
}

export function strictnessIgnored(preferences) {
  return clamp01(preferences.divergence, 0) >= DIVERGENCE_THRESHOLD;
}
