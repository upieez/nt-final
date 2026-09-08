const fs = require('fs');
const path = require('path');
const { parseRatings, analyseRatings, ratingsMarkdown, ratingsChart } = require('../lib/ratings');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'ratings.jsonl'), 'utf8');

describe('ratings analyser', () => {
  const parsed = parseRatings(FIXTURE);
  const analysis = analyseRatings(parsed);

  test('parses complete trials and counts malformed or incomplete lines', () => {
    expect(parsed.trials).toHaveLength(4);
    expect(parsed.skipped).toBe(2);
    expect(parsed.trials[0].bySystem.nexttrack).toMatchObject({ artist: 'N', coherence: 5, novelty: 3, wouldPlay: true });
  });

  test('reports per-system means, medians and would-play rates', () => {
    expect(analysis.systems.nexttrack).toEqual({ trials: 4, meanCoherence: 4, medianCoherence: 4, meanNovelty: 3, wouldPlayRate: 0.75 });
    expect(analysis.systems.random).toEqual({ trials: 4, meanCoherence: 2.25, medianCoherence: 2, meanNovelty: 3.5, wouldPlayRate: 0.25 });
    expect(analysis.systems.popular.meanCoherence).toBe(3.25);
  });

  test('counts the preferred system per trial with ties', () => {
    expect(analysis.preference).toEqual({ nexttrack: 1, random: 0, popular: 1, tie: 2 });
  });

  test('pairs NextTrack against each baseline with a sign test', () => {
    const vsRandom = analysis.paired.find((p) => p.baseline === 'random' && p.field === 'coherence');
    expect(vsRandom).toEqual({ baseline: 'random', field: 'coherence', wins: 3, losses: 0, ties: 1, shareHigher: 0.75, pValue: 0.25 });
    const vsPopular = analysis.paired.find((p) => p.baseline === 'popular' && p.field === 'coherence');
    expect(vsPopular).toMatchObject({ wins: 2, losses: 1, ties: 1, pValue: 1 });
    expect(analysis.paired).toHaveLength(6);
  });

  test('the blind study criterion is not evaluable below ten trials and passes above it', () => {
    expect(analysis.criterion.pass).toBeNull();
    const many = parseRatings(FIXTURE.split('\n').slice(0, 4).join('\n').repeat(3).replace(/}\n?{/g, '}\n{'));
    expect(many.trials).toHaveLength(12);
    expect(analyseRatings(many).criterion.pass).toBe(true);
  });

  test('writes markdown tables and an svg chart', () => {
    const md = ratingsMarkdown(analysis, 'ratings.jsonl');
    expect(md).toContain('4 complete trials from `ratings.jsonl` (2 malformed lines skipped)');
    expect(md).toContain('| NextTrack | 4 | 4 | 4 | 3 | 75% |');
    expect(md).toContain('not evaluable yet');
    expect(ratingsChart(analysis)).toContain('Blind study ratings per system');
    const empty = analyseRatings(parseRatings(''));
    expect(ratingsMarkdown(empty, 'x')).toContain('0 complete trials');
  });
});
