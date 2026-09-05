const m = require('../lib/metrics');

describe('harness metrics', () => {
  test('tag coherence is cosine similarity over normalised tag weights', () => {
    const a = [{ name: 'post-punk', weight: 100 }, { name: 'new wave', weight: 50 }];
    expect(m.tagCoherence(a, a)).toBeCloseTo(1, 6);
    expect(m.tagCoherence(a, [{ name: 'jazz', weight: 100 }])).toBe(0);
    expect(m.tagCoherence(a, [])).toBe(0);
    const b = [{ name: 'Post-Punk', weight: 10 }];
    expect(m.tagCoherence(a, b)).toBeCloseTo(2 / Math.sqrt(5), 6);
  });

  test('sharesAny compares names after normalisation', () => {
    expect(m.sharesAny(['Post Punk', 'goth'], ['post-punk'])).toBe(true);
    expect(m.sharesAny(['jazz'], ['Jazz Fusion'])).toBe(false);
    expect(m.sharesAny([], ['jazz'])).toBe(false);
  });

  test('popularity percentile uses mid-ranks for ties and needs at least two entries', () => {
    expect(m.popularityPercentile(50, [10, 20, 50, 100])).toBeCloseTo(2 / 3, 6);
    expect(m.popularityPercentile(100, [10, 20, 50, 100])).toBe(1);
    expect(m.popularityPercentile(0, [0, 0, 0])).toBeCloseTo(0.5, 6);
    expect(m.popularityPercentile(5, [5])).toBeNull();
    expect(m.popularityPercentile(null, [1, 2])).toBeNull();
  });

  test('percentile is nearest rank and ignores non-numbers', () => {
    expect(m.percentile([4, 1, 3, 2], 0.5)).toBe(2);
    expect(m.percentile([4, 1, 3, 2], 0.95)).toBe(4);
    expect(m.percentile([null, 7], 0.5)).toBe(7);
    expect(m.percentile([], 0.5)).toBeNull();
    expect(m.median([1, 2, 3, 4])).toBe(2.5);
    expect(m.mean([1, 2, null])).toBe(1.5);
    expect(m.rate([true, false, false, null])).toBeCloseTo(1 / 3, 6);
  });

  test('sign test is a two-sided exact binomial with ties dropped', () => {
    expect(m.signTest(0, 0).pValue).toBeNull();
    expect(m.signTest(5, 5).pValue).toBeCloseTo(1, 6);
    expect(m.signTest(9, 1).pValue).toBeCloseTo(0.021484, 5);
    expect(m.signTest(10, 0).pValue).toBeCloseTo(0.001953, 5);
  });

  test('seeded PRNG is deterministic and in [0, 1)', () => {
    const a = m.mulberry32(42);
    const b = m.mulberry32(42);
    const draws = Array.from({ length: 5 }, () => a());
    expect(draws).toEqual(Array.from({ length: 5 }, () => b()));
    expect(draws.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  test('fiveNumber reports min, quartiles, p95 and max', () => {
    expect(m.fiveNumber([1, 2, 3, 4, 100])).toEqual({ min: 1, p25: 2, p50: 3, p75: 4, p95: 100, max: 100 });
  });
});
