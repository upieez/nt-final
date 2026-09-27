import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecommendView from './RecommendView.jsx';
import { DEFAULT_OPTIONS, DEFAULT_PREFERENCES } from '../lib/preferences.js';

const RESPONSE = {
  recommendation: { artist: 'Siouxsie and the Banshees', title: 'Spellbound', mbid: null, wikidataId: null, listeners: 250000, image: 'https://img/s.png', tags: ['post-punk'] },
  score: 0.4321,
  breakdown: { tagOverlap: 0.31, genreOverlap: 0.2, graphSignal: 0.1, popularityPenalty: 0.05, recencyWeightApplied: true },
  explanation: { matchedTags: ['post-punk'], matchedGenres: ['post-punk'], sharedRelations: [{ type: 'label', value: 'Polydor', with: 'The Cure' }], summary: 'Shares post-punk with your most recent track.' },
  alternatives: [{ artist: 'Echo & the Bunnymen', title: 'The Killing Moon', score: 0.4, matchedTags: [], image: null }],
  candidatePool: { mode: 'dynamic', size: 38, scored: 30, scoreless: 5, excluded: 3 },
  seeds: [],
  diagnostics: { latencyMs: 812, cacheHits: 40, cacheMisses: 2, upstreamCalls: 2 },
  warnings: []
};

const HEALTH = { state: 'up', offline: false };

function json(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, text: () => Promise.resolve(JSON.stringify(body)) });
}

function Harness({ initial }) {
  const [sequence, setSequence] = useState(initial);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  return (
    <RecommendView sequence={sequence} setSequence={setSequence} preferences={preferences}
      setPreferences={setPreferences} options={DEFAULT_OPTIONS} health={HEALTH} />
  );
}

describe('RecommendView', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('PLAY posts the contract request, opens the tray, and NEXT loads the pick as the newest seed', async () => {
    const fetchMock = vi.fn((url) => {
      if (String(url).startsWith('/api/v1/tracks/info')) return json({ image: null, found: false });
      return json(RESPONSE);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Harness initial={[{ artist: 'Joy Division', title: 'Disorder', image: 'https://img/d.png' }]} />);
    await user.click(screen.getByRole('button', { name: 'Play: find the next track' }));

    expect(await screen.findByRole('heading', { name: 'Spellbound' })).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/v1/recommendations/next-track');
    expect(JSON.parse(call[1].body)).toEqual({
      sequence: [{ artist: 'Joy Division', title: 'Disorder' }],
      preferences: { divergence: 0, genreStrictness: 0.5, discoveryFactor: 0.5 },
      options: { poolMode: 'dynamic', poolSize: 40, alternatives: 5 }
    });
    expect(screen.getByText('Shares post-punk with your most recent track.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('2 / 5 · rightmost is most recent')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Spellbound' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eject Siouxsie and the Banshees - Spellbound' })).toBeInTheDocument();
  });

  it('locks the faders and the rack while scanning', async () => {
    let resolve;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { resolve = r; })));
    const user = userEvent.setup();
    render(<Harness initial={[{ artist: 'Joy Division', title: 'Disorder', image: 'x' }]} />);
    await user.click(screen.getByRole('button', { name: 'Play: find the next track' }));
    expect(screen.getByLabelText('Similarity')).toBeDisabled();
    expect(screen.getByLabelText('Strictness')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add a track' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eject Joy Division - Disorder' })).toBeDisabled();
    resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(RESPONSE)) });
    await screen.findByRole('heading', { name: 'Spellbound' });
    expect(screen.getByLabelText('Similarity')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add a track' })).toBeEnabled();
  });

  it('shows ERR on the LCD for a 504', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ error: 'Upstream timeout', source: 'lastfm' }, 504)));
    const user = userEvent.setup();
    render(<Harness initial={[{ artist: 'Joy Division', title: 'Disorder', image: 'x' }]} />);
    await user.click(screen.getByRole('button', { name: 'Play: find the next track' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/took too long/);
  });

  it('pressing + turns the LCD into a search and a result drops into the rack', async () => {
    const fetchMock = vi.fn((url) => {
      if (String(url).startsWith('/api/v1/tracks/search')) return json({ results: [{ artist: 'The Cure', title: 'A Forest', listeners: 5 }] });
      if (String(url).startsWith('/api/v1/tracks/info')) return json({ image: 'https://img/f.png', found: true });
      return json({});
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Harness initial={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add a track' }));
    await user.type(screen.getByLabelText('Search for a track'), 'forest');
    await user.click(await screen.findByRole('button', { name: 'Load A Forest by The Cure' }));
    expect(screen.getByText('1 / 5 · rightmost is most recent')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search for a track')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play: find the next track' })).toBeEnabled();
  });

  it('MANUAL entry adds a track by hand', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ image: null, found: false })));
    const user = userEvent.setup();
    render(<Harness initial={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add a track' }));
    await user.click(screen.getByRole('button', { name: 'Manual' }));
    await user.type(screen.getByLabelText('Artist'), 'Slowdive');
    await user.type(screen.getByLabelText('Title'), 'Alison');
    await user.click(screen.getByRole('button', { name: 'Load' }));
    expect(screen.getByRole('button', { name: 'Eject Slowdive - Alison' })).toBeInTheDocument();
  });
});
