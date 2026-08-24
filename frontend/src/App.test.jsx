import { render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('App shell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok', offline: true }) })));
  });

  it('states that there is no account and no history', async () => {
    render(<App />);
    expect(await screen.findByText(/offline mode/)).toBeInTheDocument();
    expect(screen.getByText(/no account, no listening history/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rating study' })).toBeInTheDocument();
  });
});
