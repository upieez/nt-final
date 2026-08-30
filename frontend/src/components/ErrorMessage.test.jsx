import { render, screen } from '@testing-library/react';
import ErrorMessage from './ErrorMessage.jsx';
import { ApiError } from '../lib/api.js';

describe('ErrorMessage', () => {
  it('renders a 400 with its details in plain language', () => {
    render(<ErrorMessage error={new ApiError(400, { error: 'Invalid request', details: ['sequence must have 1 to 10 items'] })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/request was not valid/i);
    expect(screen.getByText('sequence must have 1 to 10 items')).toBeInTheDocument();
    expect(screen.getByText('HTTP 400')).toBeInTheDocument();
  });

  it('renders 422 warnings per track', () => {
    render(<ErrorMessage error={new ApiError(422, { error: 'Unresolvable', warnings: [{ track: 'X - Y', issue: 'not found' }] })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be identified/i);
    expect(screen.getByText('X - Y: not found')).toBeInTheDocument();
  });

  it('names the upstream source for 502 and 504', () => {
    const { rerender } = render(<ErrorMessage error={new ApiError(502, { error: 'Bad gateway', source: 'lastfm' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/did not answer properly/i);
    expect(screen.getByText('Source: lastfm')).toBeInTheDocument();
    rerender(<ErrorMessage error={new ApiError(504, { error: 'Timeout', source: 'musicbrainz' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/took too long/i);
  });

  it('explains a network failure without an HTTP status', () => {
    render(<ErrorMessage error={new ApiError(0, { error: 'Failed to fetch' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not reach/i);
    expect(screen.queryByText(/HTTP/)).not.toBeInTheDocument();
  });
});
