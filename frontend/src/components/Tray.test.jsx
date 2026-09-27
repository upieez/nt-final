import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tray from './Tray.jsx';

const result = {
  recommendation: { artist: 'Burial', title: 'Archangel', listeners: 100, image: 'https://img/a.png' },
  score: 0.61,
  breakdown: { tagOverlap: 0.1, genreOverlap: 0.05, graphSignal: 0, popularityPenalty: 0.02, recencyWeightApplied: true, divergence: 0.8, divergenceApplied: true },
  explanation: { matchedTags: ['dubstep'], matchedGenres: [], sharedRelations: [], summary: 'Nothing in common with Disorder.' },
  alternatives: [{ artist: 'Four Tet', title: 'Two Thousand and Seventeen', score: 0.5, matchedTags: [], image: null }],
  candidatePool: { mode: 'dynamic', size: 60, scored: 50, scoreless: 4, excluded: 6, contrast: 30 },
  diagnostics: { latencyMs: 900, cacheHits: 10, cacheMisses: 1, upstreamCalls: 1 },
  warnings: [
    { track: '(preferences)', issue: 'genreStrictness 0.5 ignored because divergence 0.8 asks for something different' },
    { track: 'X - Y', issue: 'not found' }
  ]
};

describe('Tray', () => {
  it('stays closed with no result', () => {
    render(<Tray result={null} onUseAsSeed={() => {}} />);
    expect(screen.getByRole('region', { name: 'Result tray' })).not.toHaveClass('tray-bay-open');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('slides out with art, title, artist and the reason, and NEXT ejects the pick into the rack', async () => {
    const onUseAsSeed = vi.fn();
    const user = userEvent.setup();
    render(<Tray result={result} onUseAsSeed={onUseAsSeed} />);
    expect(screen.getByRole('region', { name: 'Result tray' })).toHaveClass('tray-bay-open');
    expect(screen.getByRole('heading', { name: 'Archangel' })).toHaveFocus();
    expect(screen.getByText('Burial')).toBeInTheDocument();
    expect(screen.getByText('Nothing in common with Disorder.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Album art for Archangel by Burial' })).toHaveAttribute('src', 'https://img/a.png');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onUseAsSeed).toHaveBeenCalledWith(result.recommendation);
  });

  it('DETAIL reveals the breakdown, alternatives, warnings and diagnostics', async () => {
    const onUseAsSeed = vi.fn();
    const user = userEvent.setup();
    render(<Tray result={result} onUseAsSeed={onUseAsSeed} />);
    expect(screen.queryByRole('img', { name: 'Divergence 0.80' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Detail' }));
    expect(screen.getByRole('img', { name: 'Divergence 0.80' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/Strictness was bypassed for this pick/);
    expect(screen.getByText('X - Y: not found')).toBeInTheDocument();
    expect(screen.getByText(/30 contrast/)).toBeInTheDocument();
    expect(screen.getByText(/blended toward its opposite/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Two Thousand and Seventeen/ }));
    expect(onUseAsSeed).toHaveBeenCalledWith(result.alternatives[0]);
  });

  it('LISTEN swaps the art for the YouTube player', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ videoId: 'abcdefghijk' })) })));
    const user = userEvent.setup();
    render(<Tray result={result} onUseAsSeed={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Listen' }));
    expect(await screen.findByTitle('YouTube player for Burial Archangel')).toHaveAttribute('src', 'https://www.youtube.com/embed/abcdefghijk');
  });
});
