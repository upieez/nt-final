import { addTrack, moveTrack, removeTrack, MAX_SEQUENCE } from './sequence.js';

const a = { artist: 'Joy Division', title: 'Disorder' };
const b = { artist: 'The Cure', title: 'A Forest' };
const c = { artist: 'Bauhaus', title: 'Bela Lugosi\'s Dead' };

describe('sequence helpers', () => {
  it('trims and appends a track, ignoring duplicates and blanks', () => {
    let seq = addTrack([], { artist: ' Joy Division ', title: 'Disorder ' });
    expect(seq).toEqual([a]);
    seq = addTrack(seq, { artist: 'joy division', title: 'DISORDER' });
    expect(seq).toHaveLength(1);
    expect(addTrack(seq, { artist: '', title: 'x' })).toBe(seq);
  });

  it('refuses to grow past the maximum', () => {
    let seq = [];
    for (let i = 0; i < MAX_SEQUENCE + 2; i += 1) {
      seq = addTrack(seq, { artist: `Artist ${i}`, title: `Title ${i}` });
    }
    expect(seq).toHaveLength(MAX_SEQUENCE);
  });

  it('moves items up and down and clamps at the edges', () => {
    const seq = [a, b, c];
    expect(moveTrack(seq, 1, -1)).toEqual([b, a, c]);
    expect(moveTrack(seq, 1, 1)).toEqual([a, c, b]);
    expect(moveTrack(seq, 0, -1)).toBe(seq);
    expect(moveTrack(seq, 2, 1)).toBe(seq);
  });

  it('removes by index', () => {
    expect(removeTrack([a, b, c], 1)).toEqual([a, c]);
  });
});
