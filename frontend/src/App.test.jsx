import { render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('App shell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ status: 'ok', offline: true })) })));
  });

  it('shows the link readout on the LCD and the stateless note on the faceplate', async () => {
    render(<App />);
    expect(await screen.findByText('OFFLINE MODE')).toBeInTheDocument();
    expect(screen.getByText(/no account, no listening history/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Study' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play: find the next track' })).toBeDisabled();
  });
});
