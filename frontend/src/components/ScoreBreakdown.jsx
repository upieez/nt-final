const PARTS = [
  { key: 'divergence', label: 'Divergence' },
  { key: 'tagOverlap', label: 'Tag overlap' },
  { key: 'genreOverlap', label: 'Genre overlap' },
  { key: 'graphSignal', label: 'Graph signal' },
  { key: 'popularityPenalty', label: 'Popularity penalty', negative: true }
];

export default function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;
  const max = Math.max(0.01, ...PARTS.map((p) => Math.abs(Number(breakdown[p.key]) || 0)));
  return (
    <div className="breakdown">
      <h3>Score breakdown</h3>
      <ul className="bars" aria-label="Score components">
        {PARTS.map((p) => {
          const value = Number(breakdown[p.key]) || 0;
          const width = `${Math.round((Math.abs(value) / max) * 100)}%`;
          return (
            <li key={p.key} className="bar-row">
              <span className="bar-label">{p.label}</span>
              <span className="bar-track" role="img" aria-label={`${p.label} ${value.toFixed(2)}`}>
                <span className={`bar-fill${p.negative ? ' bar-fill-negative' : ''}`} style={{ width }} />
              </span>
              <span className="bar-value" aria-hidden="true">{p.negative && value > 0 ? '-' : ''}{value.toFixed(2)}</span>
            </li>
          );
        })}
      </ul>
      <p className="small muted">
        {breakdown.recencyWeightApplied
          ? 'Later tracks in your sequence were weighted more heavily. '
          : 'All tracks in your sequence were weighted equally. '}
        {breakdown.divergenceApplied
          ? 'Similarity was blended toward its opposite, so less similar candidates ranked higher.'
          : 'Divergence was off, so the most similar candidate wins.'}
      </p>
    </div>
  );
}
