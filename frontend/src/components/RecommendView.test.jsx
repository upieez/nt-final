import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecommendView from './RecommendView.jsx';
import { DEFAULT_OPTIONS, DEFAULT_PREFERENCES } from '../lib/preferences.js';

const RESPONSE = {
  recommendation: { artist: 'Siouxsie and the Banshees', title: 'Spellbound', mbid: null, wikidataId: null, listeners: 250000, tags: ['post-punk'] },
  score: 0.4321,
  breakdown: { tagOverlap: 0.31, genreOverlap: 0.2, graphSignal: 0.1, popularityPenalty: 0.05, recencyWeightApplied: true },
  explanation: { matchedTags: ['post-punk'], matchedGenres: ['post-punk'], sharedRelations: [{ type: 'label', value: 'Polydor', with: 'The Cure' }], summary: 'Shares post-punk with your most recent track.' },
  alternatives: [{ artist: 'Echo & the Bunnymen', title: 'The Killing Moon', score: 0.4, matchedTags: [] }],
  candidatePool: { mode: 'dynamic', size: 38, scored: 30, scoreless: 5, excluded: 3 },
  seeds: [],
  diagnostics: { latencyMs: 812, cacheHits: 40, cacheMisses: 2, upstreamCalls: 2 },
  warnings: []
};

function Harness() {
  const [sequence, setSequence] = useState([{ artist: 'Joy Division', title: 'Disorder' }]);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  return (
    <RecommendView sequence={sequence} setSequence={setSequence} preferences={preferences}
      setPreferences={setPreferences} options={options} setOptions={setOptions} />
  );
}

describe('RecommendView', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('posts the contract request and renders the result card', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(RESPONSE)) }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Recommend the next track' }));

    expect(await screen.findByText('Spellbound')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/recommendations/next-track');
    expect(JSON.parse(init.body)).toEqual({
      sequence: [{ artist: 'Joy Division', title: 'Disorder' }],
      preferences: { genreStrictness: 0.5, discoveryFactor: 0.5 },
      options: { poolMode: 'dynamic', poolSize: 40, alternatives: 5 }
    });
    expect(screen.getByText('Shares post-punk with your most recent track.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tag overlap 0.31' })).toBeInTheDocument();
    expect(screen.getByText(/Latency 812 ms/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /The Killing Moon/ }));
    expect(screen.getByText('2 / 10 tracks')).toBeInTheDocument();
    expect(screen.queryByText('Spellbound')).not.toBeInTheDocument();
  });

  it('shows a plain-language error for a 504', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 504, text: () => Promise.resolve(JSON.stringify({ error: 'Upstream timeout', source: 'lastfm' })) })));
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Recommend the next track' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/took too long/);
  });
});
