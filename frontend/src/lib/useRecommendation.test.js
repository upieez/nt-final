import { act, renderHook } from '@testing-library/react';
import useRecommendation from './useRecommendation.js';
import { DEFAULT_OPTIONS, DEFAULT_PREFERENCES } from './preferences.js';

describe('useRecommendation', () => {
  it('ignores a response that arrives after reset', async () => {
    let resolve;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { resolve = r; })));
    const { result } = renderHook(() => useRecommendation());
    act(() => { result.current.recommend([{ artist: 'a', title: 'b' }], DEFAULT_PREFERENCES, DEFAULT_OPTIONS); });
    expect(result.current.loading).toBe(true);
    act(() => { result.current.reset(); });
    expect(result.current.loading).toBe(false);
    await act(async () => {
      resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ recommendation: { artist: 'x', title: 'y' } })) });
    });
    expect(result.current.result).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
