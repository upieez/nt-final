import { render, screen, fireEvent } from '@testing-library/react';
import Lcd from './Lcd.jsx';
import { ApiError } from '../lib/api.js';

describe('Lcd', () => {
  it('scrolls the seed list', () => {
    render(<Lcd status={{ kind: 'seeds', sequence: [{ artist: 'Joy Division', title: 'Disorder' }] }} health={{ state: 'up', offline: false }} />);
    expect(screen.getAllByText(/1\. Joy Division - Disorder/)[0]).toBeInTheDocument();
    expect(screen.getByText('LINK OK')).toBeInTheDocument();
  });

  it('shows a scanning animation while loading', () => {
    render(<Lcd status={{ kind: 'loading' }} health={{ state: 'down' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('SCANNING');
    expect(screen.getByText('NO LINK')).toBeInTheDocument();
  });

  it('shows ERR and a plain-language line on failure', () => {
    render(<Lcd status={{ kind: 'error', error: new ApiError(504, { error: 'Upstream timeout', source: 'lastfm' }) }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/ERR/);
    expect(screen.getByRole('alert')).toHaveTextContent(/took too long/);
  });

  it('becomes a search field when a search is open', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<Lcd status={{ kind: 'idle' }} search={{ value: 'dis', onChange, onClose, status: 'done', count: 3 }} />);
    const input = screen.getByLabelText('Search for a track');
    expect(input).toHaveValue('dis');
    fireEvent.change(input, { target: { value: 'diso' } });
    expect(onChange).toHaveBeenCalledWith('diso');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('3 HITS')).toBeInTheDocument();
  });
});
