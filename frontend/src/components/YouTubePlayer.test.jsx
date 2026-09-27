import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YouTubePlayer, { youtubeEmbedUrl, youtubeSearchUrl } from './YouTubePlayer.jsx';

function json(body) {
  return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) });
}

describe('YouTubePlayer', () => {
  it('builds embed and search URLs', () => {
    expect(youtubeEmbedUrl('kkASIx9Xk6s')).toBe('https://www.youtube.com/embed/kkASIx9Xk6s');
    expect(youtubeSearchUrl({ artist: 'Joy Division', title: 'Disorder' }))
      .toBe('https://www.youtube.com/results?search_query=Joy%20Division%20Disorder');
  });

  it('asks the backend for the video only after the user loads the player, then embeds it', async () => {
    const fetchMock = vi.fn(() => json({ videoId: 'kkASIx9Xk6s', searchUrl: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<YouTubePlayer track={{ artist: 'The Cure', title: 'A Forest' }} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByTitle(/YouTube player/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load YouTube player' }));
    const frame = await screen.findByTitle('YouTube player for The Cure A Forest');
    expect(frame).toHaveAttribute('src', 'https://www.youtube.com/embed/kkASIx9Xk6s');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/tracks/video?artist=The%20Cure&title=A%20Forest');
  });

  it('offers a YouTube search link when no video is found', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ videoId: null, searchUrl: 'x' })));
    render(<YouTubePlayer track={{ artist: 'Nobody', title: 'Nothing' }} loaded onLoad={() => {}} />);
    const link = await screen.findByRole('link', { name: 'Open on YouTube' });
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/results?search_query=Nobody%20Nothing');
  });
});
