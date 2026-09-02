const { buildSummary } = require('../lib/explain');

const base = { matchedTags: [], matchedGenres: [], sharedRelations: [], mostRecentArtist: 'The Cure' };

describe('summary sentences', () => {
  test('similar mode names shared tags, genres and grouped relations', () => {
    const summary = buildSummary({ ...base, matchedTags: ['post-punk'], matchedGenres: ['gothic rock'], sharedRelations: [{ type: 'label', value: 'Factory Records', with: 'Joy Division' }, { type: 'label', value: 'Factory Records', with: 'New Order' }] });
    expect(summary).toBe('Shares post-punk with your most recent tracks, and matches the gothic rock genre on MusicBrainz and Wikidata, and has the same label (Factory Records) as Joy Division and New Order.');
  });

  test('similar mode with no evidence falls back to a plain sentence', () => {
    expect(buildSummary(base)).toBe('Closest available match to The Cure in the candidate pool.');
  });

  test('divergent mode names what the pick does not share', () => {
    const summary = buildSummary({ ...base, divergence: 1, candidateTags: [{ name: 'jazz', weight: 100 }], recentTags: [{ name: 'post-punk', weight: 100 }, { name: '80s', weight: 20 }] });
    expect(summary).toBe('Chosen to be far from your recent tracks: jazz rather than the post-punk and 80s of The Cure, sharing no tags, genres or relations with them.');
  });

  test('divergent mode names the single tag still shared', () => {
    const summary = buildSummary({ ...base, divergence: 0.5, matchedTags: ['rock'], candidateTags: [{ name: 'rock', weight: 100 }], recentTags: [] });
    expect(summary).toBe('Chosen to be far from your recent tracks: rock, still sharing only rock.');
  });

  test('below the divergence threshold the similar sentence is used', () => {
    expect(buildSummary({ ...base, divergence: 0.4, matchedTags: ['post-punk'] })).toBe('Shares post-punk with your most recent tracks.');
  });
});
