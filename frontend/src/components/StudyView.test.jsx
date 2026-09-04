import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudyView from './StudyView.jsx';
import { DEFAULT_PREFERENCES } from '../lib/preferences.js';

describe('StudyView', () => {
  it('sends the chosen divergence with the compare request', async () => {
    window.scrollTo = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true, status: 200,
      text: () => Promise.resolve(JSON.stringify({ trialId: 't1', items: [
        { slot: 'A', artist: 'a', title: 'a' }, { slot: 'B', artist: 'b', title: 'b' }, { slot: 'C', artist: 'c', title: 'c' }
      ] }))
    }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<StudyView sequence={[]} preferences={DEFAULT_PREFERENCES} />);
    await user.click(screen.getByRole('button', { name: 'I understand, start' }));
    fireEvent.change(screen.getByLabelText('Similar or different?'), { target: { value: '0.9' } });
    await user.click(screen.getByRole('button', { name: 'Get three candidates' }));
    expect(await screen.findByText('Option A')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/study/compare');
    expect(JSON.parse(init.body).preferences).toEqual({ divergence: 0.9, genreStrictness: 0.5, discoveryFactor: 0.5 });
  });
});
