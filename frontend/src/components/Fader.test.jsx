import { render, screen, fireEvent } from '@testing-library/react';
import Fader from './Fader.jsx';
import FaderBank from './FaderBank.jsx';
import { DEFAULT_PREFERENCES } from '../lib/preferences.js';

describe('Fader', () => {
  it('clamps values into 0 to 1 and reports changes', () => {
    const onChange = vi.fn();
    render(<Fader label="Discovery" value={2} onChange={onChange} low="Hits" high="Deep cuts" />);
    const input = screen.getByLabelText('Discovery');
    expect(input).toHaveValue('1');
    fireEvent.change(input, { target: { value: '0.25' } });
    expect(onChange).toHaveBeenCalledWith(0.25);
    expect(screen.getByText('1.00')).toBeInTheDocument();
  });

  it('shows -- when bypassed', () => {
    render(<Fader label="Strictness" value={0.5} onChange={() => {}} low="Loose" high="Strict" bypassed />);
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByLabelText('Strictness')).toHaveAttribute('aria-valuetext', '0.50, bypassed');
  });
});

describe('FaderBank', () => {
  it('maps SIMILARITY to the inverse of divergence and bypasses strictness below the midpoint', () => {
    const onChange = vi.fn();
    const { rerender } = render(<FaderBank preferences={DEFAULT_PREFERENCES} onChange={onChange} />);
    expect(screen.getByLabelText('Similarity')).toHaveValue('1');
    fireEvent.change(screen.getByLabelText('Similarity'), { target: { value: '0.3' } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_PREFERENCES, divergence: 0.7 });
    rerender(<FaderBank preferences={{ ...DEFAULT_PREFERENCES, divergence: 0.7 }} onChange={onChange} />);
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByLabelText('Strictness')).toHaveAttribute('aria-valuetext', '0.50, bypassed');
  });
});
