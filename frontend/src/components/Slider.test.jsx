import { render, screen, fireEvent } from '@testing-library/react';
import Slider from './Slider.jsx';
import { clamp01 } from '../lib/preferences.js';

describe('Slider', () => {
  it('clamps values into the 0 to 1 range', () => {
    expect(clamp01(1.7)).toBe(1);
    expect(clamp01(-0.3)).toBe(0);
    expect(clamp01('abc')).toBe(0.5);
    const onChange = vi.fn();
    render(<Slider label="Discovery" value={2} onChange={onChange}
      lowCaption="low" highCaption="high" help="help" />);
    const input = screen.getByLabelText('Discovery');
    expect(input).toHaveValue('1');
    fireEvent.change(input, { target: { value: '0.25' } });
    expect(onChange).toHaveBeenCalledWith(0.25);
  });
});
