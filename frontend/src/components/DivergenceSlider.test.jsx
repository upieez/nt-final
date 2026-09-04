import { render, screen, fireEvent } from '@testing-library/react';
import DivergenceSlider from './DivergenceSlider.jsx';
import { DEFAULT_PREFERENCES, buildRequest, clamp01, strictnessIgnored } from '../lib/preferences.js';

describe('DivergenceSlider', () => {
  it('defaults to 0, clamps into [0,1] and reports when strictness is ignored', () => {
    expect(DEFAULT_PREFERENCES.divergence).toBe(0);
    expect(clamp01('nope', 0)).toBe(0);
    expect(clamp01(3, 0)).toBe(1);
    expect(strictnessIgnored({ divergence: 0.45 })).toBe(false);
    expect(strictnessIgnored({ divergence: 0.5 })).toBe(true);
    const onChange = vi.fn();
    render(<DivergenceSlider value={-2} onChange={onChange} />);
    const input = screen.getByLabelText('Similar or different?');
    expect(input).toHaveValue('0');
    expect(screen.getByText('Similar to what I just played')).toBeInTheDocument();
    expect(screen.getByText('Something completely different')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '0.75' } });
    expect(onChange).toHaveBeenCalledWith(0.75);
  });

  it('is sent as preferences.divergence in the request body', () => {
    const body = buildRequest([{ artist: 'A', title: 'B' }], { ...DEFAULT_PREFERENCES, divergence: 0.8 }, { poolMode: 'dynamic' });
    expect(body.preferences.divergence).toBe(0.8);
    const clamped = buildRequest([], { ...DEFAULT_PREFERENCES, divergence: 7 }, {});
    expect(clamped.preferences.divergence).toBe(1);
  });
});
