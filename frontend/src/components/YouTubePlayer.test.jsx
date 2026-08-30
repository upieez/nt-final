import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YouTubePlayer, { youtubeSearchEmbedUrl } from './YouTubePlayer.jsx';

describe('YouTubePlayer', () => {
  it('builds a keyless search-list embed URL', () => {
    expect(youtubeSearchEmbedUrl({ artist: 'Joy Division', title: 'Disorder' }))
      .toBe('https://www.youtube.com/embed?listType=search&list=Joy%20Division%20Disorder');
  });

  it('only loads the iframe after the user asks for it', async () => {
    const user = userEvent.setup();
    render(<YouTubePlayer track={{ artist: 'The Cure', title: 'A Forest' }} />);
    expect(screen.queryByTitle(/YouTube search results/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load YouTube player' }));
    expect(screen.getByTitle('YouTube search results for The Cure A Forest')).toBeInTheDocument();
  });
});
