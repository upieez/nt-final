const svg = require('../lib/svg');

describe('svg writer', () => {
  test('bar chart draws one rect per finite value and escapes labels', () => {
    const out = svg.barChart({ title: 'A & B', categories: ['x', 'y'], series: [{ name: 's1', values: [0.5, null] }, { name: 's2', values: [0.25, 1] }] });
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(out).toContain('A &amp; B');
    expect((out.match(/<rect [^>]*><title>/g) || []).length).toBe(3);
  });

  test('histogram bins values into equal ranges with the last bin closed', () => {
    expect(svg.binCounts([0, 0.1, 0.55, 1, 1, NaN], 4, [0, 1])).toEqual([2, 0, 1, 2]);
    const out = svg.histogram({ title: 'h', series: [{ name: 'a', values: [0.2, 0.9] }], bins: 5 });
    expect(out).toContain('0-0.20');
    expect(out).toContain('0.80-1');
  });

  test('box summary draws a box, a median line and whiskers per item', () => {
    const out = svg.boxSummary({ title: 'latency', unit: ' ms', items: [{ name: 'nexttrack', min: 10, p25: 20, p50: 30, p75: 40, max: 100 }] });
    expect(out).toContain('p50 30 ms, max 100 ms');
    expect((out.match(/<rect /g) || []).length).toBe(2);
  });

  test('niceMax rounds up to a readable axis maximum', () => {
    expect(svg.niceMax([0.37])).toBe(0.5);
    expect(svg.niceMax([812])).toBe(1000);
    expect(svg.niceMax([])).toBe(1);
  });
});
