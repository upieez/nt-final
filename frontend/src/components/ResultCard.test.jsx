import { render, screen } from '@testing-library/react';
import ResultCard from './ResultCard.jsx';

const result = {
  recommendation: { artist: 'Burial', title: 'Archangel', listeners: 100 },
  score: 0.61,
  breakdown: { tagOverlap: 0.1, genreOverlap: 0.05, graphSignal: 0, popularityPenalty: 0.02, recencyWeightApplied: true, divergence: 0.8, divergenceApplied: true },
  explanation: { matchedTags: [], matchedGenres: [], sharedRelations: [], summary: 'Nothing in common with Disorder.' },
  alternatives: [],
  candidatePool: { mode: 'dynamic', size: 60, scored: 50, scoreless: 4, excluded: 6, contrast: 30 },
  diagnostics: { latencyMs: 900, cacheHits: 10, cacheMisses: 1, upstreamCalls: 1 },
  warnings: [
    { track: '(preferences)', issue: 'genreStrictness 0.5 ignored because divergence 0.8 asks for something different' },
    { track: 'X - Y', issue: 'not found' }
  ]
};

describe('ResultCard with divergence', () => {
  it('shows the divergence bar, the strictness-ignored warning and the contrast count', () => {
    render(<ResultCard result={result} onUseAsSeed={() => {}} />);
    expect(screen.getByRole('img', { name: 'Divergence 0.80' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/Genre strictness was ignored for this pick/);
    expect(screen.getByRole('note')).toHaveTextContent(/divergence 0.8/);
    expect(screen.getByText('X - Y: not found')).toBeInTheDocument();
    expect(screen.getByText(/30 contrast/)).toBeInTheDocument();
    expect(screen.getByText(/blended toward its opposite/)).toBeInTheDocument();
  });
});
