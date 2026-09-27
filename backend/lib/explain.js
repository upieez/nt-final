const { normaliseName } = require('./reconcile');
const { highDivergence } = require('./scoring');

const MAX_TAGS_SHOWN = 10;

function joinNames(names) {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const RELATION_ORDER = ['member', 'label', 'artist', 'country'];

function relationPhrase(type, value, withNames) {
  switch (type) {
    case 'label': return `the same label (${value}) as ${joinNames(withNames)}`;
    case 'member': return `a shared member link (${value}) with ${joinNames(withNames)}`;
    case 'country': return `the same country as ${joinNames(withNames)}`;
    case 'artist': return `the same artist as ${joinNames(withNames)}`;
    default: return null;
  }
}

function relationPhrases(sharedRelations) {
  const groups = new Map();
  for (const r of sharedRelations) {
    const key = `${r.type}|${r.value}`;
    if (!groups.has(key)) groups.set(key, { type: r.type, value: r.value, withNames: [] });
    if (!groups.get(key).withNames.includes(r.with)) groups.get(key).withNames.push(r.with);
  }
  return [...groups.values()]
    .sort((a, b) => RELATION_ORDER.indexOf(a.type) - RELATION_ORDER.indexOf(b.type))
    .map((g) => relationPhrase(g.type, g.value, g.withNames))
    .filter(Boolean);
}

function buildDivergentSummary({ matchedTags, matchedGenres, candidateTags, recentTags, mostRecentArtist }) {
  const own = topTagNames(candidateTags).slice(0, 3);
  const recent = topTagNames(recentTags).slice(0, 3);
  const shared = [...new Set([...matchedTags, ...matchedGenres])];
  const lead = `Chosen to be far from your recent tracks${own.length ? `: ${joinNames(own)}` : ''}`;
  const contrast = recent.length ? ` rather than the ${joinNames(recent)} of ${mostRecentArtist}` : '';
  if (shared.length === 0) return `${lead}${contrast}, sharing no tags, genres or relations with them.`;
  if (shared.length === 1) return `${lead}${contrast}, still sharing only ${shared[0]}.`;
  return `${lead}${contrast}, still sharing ${joinNames(shared.slice(0, 3))}.`;
}

function buildSummary({ matchedTags, matchedGenres, sharedRelations, mostRecentArtist, divergence = 0, candidateTags = [], recentTags = [] }) {
  if (highDivergence(divergence)) return buildDivergentSummary({ matchedTags, matchedGenres, candidateTags, recentTags, mostRecentArtist });
  const parts = [];
  if (matchedTags.length) parts.push(`Shares ${joinNames(matchedTags.slice(0, 3))} with your most recent tracks`);
  const tagKeys = matchedTags.map(normaliseName);
  const extraGenres = matchedGenres.filter((g) => !tagKeys.includes(normaliseName(g)));
  if (extraGenres.length) parts.push(`${parts.length ? 'matches' : 'Matches'} the ${joinNames(extraGenres.slice(0, 2))} genre${extraGenres.length > 1 ? 's' : ''} on MusicBrainz and Wikidata`);
  const phrases = relationPhrases(sharedRelations).slice(0, 2);
  if (phrases.length) parts.push(`${parts.length ? 'has' : 'Has'} ${joinNames(phrases)}`);
  if (!parts.length) return `Closest available match to ${mostRecentArtist} in the candidate pool.`;
  return `${parts.join(', and ')}.`;
}

function topTagNames(tags) {
  return [...(tags || [])].sort((a, b) => b.weight - a.weight).slice(0, MAX_TAGS_SHOWN).map((t) => t.name);
}

module.exports = { buildSummary, topTagNames };
