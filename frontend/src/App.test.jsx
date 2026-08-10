import { render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('App shell', () => {
  it('states that there is no account and no history', () => {
    render(<App />);
    expect(screen.getByText(/no account, no listening history/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rating study' })).toBeInTheDocument();
  });
});
