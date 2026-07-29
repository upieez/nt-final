const { normaliseName, trackKey, sameName } = require('../lib/reconcile');

describe('normaliseName', () => {
  test.each([
    ['Sigur Rós', 'sigur ros'],
    ['Beyoncé feat. Jay-Z', 'beyonce'],
    ['Beyoncé ft Jay-Z', 'beyonce'],
    ['Crazy in Love (feat. Jay-Z)', 'crazy in love'],
    ["Bela Lugosi's Dead (Live)", 'bela lugosis dead'],
    ["Bela Lugosi's Dead", 'bela lugosis dead'],
    ['Close Your Eyes (And Count to Fuck)', 'close your eyes and count to fuck'],
    ['Run the Jewels', 'run the jewels'],
    ['The Cure', 'cure'],
    ['A Forest - 2005 Remaster', 'a forest'],
    ['Disorder (2007 Remastered Version)', 'disorder'],
    ['Echo & the Bunnymen', 'echo and the bunnymen'],
    ['N.Y. State of Mind', 'n y state of mind'],
    ['  Boards   of Canada ', 'boards of canada'],
    ['Anaïs Mitchell', 'anais mitchell'],
    ['MF DOOM', 'mf doom'],
    ['The The', 'the the']
  ])('%s -> %s', (input, expected) => {
    expect(normaliseName(input)).toBe(expected);
  });

  test('keepThe preserves the leading article', () => {
    expect(normaliseName('The Cure', { keepThe: true })).toBe('the cure');
  });

  test('non-strings normalise to an empty string', () => {
    expect(normaliseName(null)).toBe('');
    expect(normaliseName(42)).toBe('');
  });
});

describe('trackKey and sameName', () => {
  test('keys ignore case, diacritics and remaster suffixes', () => {
    expect(trackKey('The Cure', 'A Forest - 2005 Remaster')).toBe(trackKey('the cure', 'A FOREST'));
  });

  test('sameName never matches two empty strings', () => {
    expect(sameName('', '')).toBe(false);
    expect(sameName('Sigur Ros', 'Sigur Rós')).toBe(true);
  });
});
