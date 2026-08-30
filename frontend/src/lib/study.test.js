import { allRatingsComplete, emptyRatings, ratingComplete } from './study.js';

const items = [{ slot: 'A' }, { slot: 'B' }, { slot: 'C' }];

describe('study ratings', () => {
  it('starts empty and only completes when every field of every slot is set', () => {
    const ratings = emptyRatings(items);
    expect(allRatingsComplete(ratings)).toBe(false);
    expect(ratingComplete({ coherence: 6, novelty: 3, wouldPlay: true })).toBe(false);
    const full = { coherence: 4, novelty: 2, wouldPlay: false };
    expect(allRatingsComplete({ A: full, B: full, C: full })).toBe(true);
    expect(allRatingsComplete({ A: full, B: full, C: { ...full, wouldPlay: null } })).toBe(false);
  });
});
