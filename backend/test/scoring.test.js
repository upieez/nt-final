const scoring = require('../lib/scoring');

const seedsFor = (tagLists) => tagLists.map((tags) => ({ tags: tags.map(([name, weight]) => ({ name, weight })), confidence: 1 }));

describe('tag overlap', () => {
  test('identical tag vectors score 1 and a disjoint vector scores 0', () => {
    const seeds = seedsFor([[['post-punk', 100], ['new wave', 50]]]);
    const { sequenceTagWeights, mostRecentTags } = scoring.buildSequenceTagSet(seeds);
    const same = scoring.scoreCandidate([{ name: 'post-punk', weight: 100 }, { name: 'new wave', weight: 50 }], sequenceTagWeights, mostRecentTags);
    const other = scoring.scoreCandidate([{ name: 'pop', weight: 100 }], sequenceTagWeights, mostRecentTags);
    expect(same.tagOverlap).toBeCloseTo(1, 6);
    expect(same.overlapsMostRecent).toBe(true);
    expect(other.tagOverlap).toBe(0);
    expect(other.overlapsMostRecent).toBe(false);
  });

  test('the most recent seed outweighs earlier seeds by the recency base', () => {
    const seeds = seedsFor([[['metal', 100]], [['ambient', 100]], [['post-punk', 100]]]);
    const { sequenceTagWeights } = scoring.buildSequenceTagSet(seeds);
    expect(sequenceTagWeights.get('post-punk')).toBeCloseTo(1, 6);
    expect(sequenceTagWeights.get('ambient')).toBeCloseTo(scoring.RECENCY_BASE, 6);
    expect(sequenceTagWeights.get('metal')).toBeCloseTo(scoring.RECENCY_BASE ** 2, 6);
  });

  test('artist-level candidate tags are discounted by the confidence factor', () => {
    const seeds = seedsFor([[['post-punk', 100]]]);
    const { sequenceTagWeights, mostRecentTags } = scoring.buildSequenceTagSet(seeds);
    const result = scoring.scoreCandidate([{ name: 'post-punk', weight: 100 }], sequenceTagWeights, mostRecentTags, scoring.ARTIST_TAG_CONFIDENCE);
    expect(result.tagOverlap).toBeCloseTo(scoring.ARTIST_TAG_CONFIDENCE, 6);
  });
});

describe('genre overlap', () => {
  test('covers the recency-weighted genre mass and keeps display spellings', () => {
    const seeds = [{ genres: ['Post-Punk', 'new wave'] }, { genres: ['gothic rock'] }];
    const { sequenceGenreWeights, mostRecentGenres } = scoring.buildSequenceGenreSet(seeds);
    const result = scoring.scoreGenres(['post punk', 'Gothic Rock'], sequenceGenreWeights, mostRecentGenres);
    const total = 0.6 * 0.5 + 0.6 * 0.5 + 1;
    expect(result.genreOverlap).toBeCloseTo((0.6 * 0.5 + 1) / total, 6);
    expect(result.matchedGenres).toEqual(['post punk', 'Gothic Rock']);
    expect(result.overlapsMostRecent).toBe(true);
  });

  test('no genres anywhere gives 0 without dividing by zero', () => {
    const { sequenceGenreWeights, mostRecentGenres } = scoring.buildSequenceGenreSet([{ genres: [] }]);
    expect(scoring.scoreGenres([], sequenceGenreWeights, mostRecentGenres).genreOverlap).toBe(0);
  });
});

describe('graph signal', () => {
  const cure = { mbid: 'cure', name: 'The Cure', country: 'GB', labels: ['Fiction Records'], members: ['Robert Smith'], memberOf: [] };
  const joy = { mbid: 'jd', name: 'Joy Division', country: 'GB', labels: ['Factory Records'], members: ['Peter Hook', 'Bernard Sumner'], memberOf: [] };
  const newOrder = { mbid: 'no', name: 'New Order', country: 'GB', labels: ['Factory Records'], members: ['Peter Hook', 'Bernard Sumner'], memberOf: [] };
  const hook = { mbid: 'hook', name: 'Peter Hook', country: 'GB', labels: [], members: [], memberOf: ['Joy Division', 'New Order'] };

  test('shared members and label stack, capped at 1', () => {
    const relations = scoring.relationsBetween(newOrder, joy);
    expect(relations).toEqual([{ type: 'member', value: 'Peter Hook' }, { type: 'label', value: 'Factory Records' }, { type: 'country', value: 'GB' }]);
    const { graphSignal } = scoring.scoreGraph(newOrder, [joy]);
    expect(graphSignal).toBe(1);
  });

  test('a solo artist who is a member of the seed band links through memberOf', () => {
    expect(scoring.relationsBetween(hook, joy)[0]).toEqual({ type: 'member', value: 'Peter Hook' });
    expect(scoring.relationsBetween(hook, { ...joy, members: [] })[0]).toEqual({ type: 'member', value: 'Joy Division' });
  });

  test('same country alone is a weak signal, weighted by recency across seeds', () => {
    const { graphSignal, sharedRelations } = scoring.scoreGraph(cure, [joy, newOrder]);
    expect(graphSignal).toBeCloseTo(scoring.GRAPH_WEIGHTS.country, 6);
    expect(sharedRelations).toEqual([{ type: 'country', value: 'GB', with: 'Joy Division' }, { type: 'country', value: 'GB', with: 'New Order' }]);
  });

  test('the same artist as a seed is reported as an artist relation only', () => {
    expect(scoring.relationsBetween(cure, cure)).toEqual([{ type: 'artist', value: 'The Cure' }]);
  });

  test('missing entities contribute nothing', () => {
    expect(scoring.scoreGraph({ name: null }, [joy]).graphSignal).toBe(0);
    expect(scoring.scoreGraph(cure, []).graphSignal).toBe(0);
  });
});

describe('combination, penalties and filters', () => {
  test('weights sum to one and combine linearly', () => {
    expect(scoring.W_TAG + scoring.W_GENRE + scoring.W_GRAPH).toBeCloseTo(1, 9);
    expect(scoring.combineSignals({ tagOverlap: 1, genreOverlap: 1, graphSignal: 1 })).toBeCloseTo(1, 9);
    expect(scoring.combineSignals({ tagOverlap: 0.5, genreOverlap: 0, graphSignal: 0 })).toBeCloseTo(0.25, 9);
  });

  test('discovery penalty removes the whole score for the most popular candidate at factor 1', () => {
    const result = scoring.applyDiscoveryPenalty(0.5, 1000, 1000, 1);
    expect(result.adjustedScore).toBeCloseTo(0, 9);
    expect(result.popularityPenalty).toBeCloseTo(0.5, 9);
    expect(scoring.applyDiscoveryPenalty(0.5, 1000, 1000, 0).adjustedScore).toBe(0.5);
  });

  test('divergence blends the score toward its complement', () => {
    expect(scoring.applyDivergence(0.8, 0)).toBe(0.8);
    expect(scoring.applyDivergence(0.8, 1)).toBeCloseTo(0.2, 9);
    expect(scoring.applyDivergence(0.8, 0.5)).toBeCloseTo(0.5, 9);
    expect(scoring.highDivergence(0.49)).toBe(false);
    expect(scoring.highDivergence(0.5)).toBe(true);
  });

  test('soft strictness damps candidates that miss the most recent seed below the hard threshold', () => {
    expect(scoring.applyStrictness(0.4, false, 0.5)).toBeCloseTo(0.3, 9);
    expect(scoring.applyStrictness(0.4, true, 0.5)).toBe(0.4);
    expect(scoring.applyStrictness(0.4, false, 0.9)).toBe(0.4);
  });

  test('target genre matches tags or genres after normalisation', () => {
    expect(scoring.matchesTargetGenre('Post Punk', [{ name: 'post-punk', weight: 1 }], [])).toBe(true);
    expect(scoring.matchesTargetGenre('gothic rock', [], ['Gothic Rock'])).toBe(true);
    expect(scoring.matchesTargetGenre('metal', [{ name: 'post-punk', weight: 1 }], ['pop'])).toBe(false);
    expect(scoring.matchesTargetGenre(null, [], [])).toBe(true);
  });

  test('ranking breaks ties toward the less popular candidate', () => {
    const ranked = scoring.rankCandidates([{ adjustedScore: 0.3, listeners: 900 }, { adjustedScore: 0.3, listeners: 100 }, { adjustedScore: 0.5, listeners: 5000 }]);
    expect(ranked.map((r) => r.listeners)).toEqual([5000, 100, 900]);
  });
});
