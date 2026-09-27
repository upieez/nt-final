import ScoreBreakdown from './ScoreBreakdown.jsx';

function TagList({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="detail-row">
      <span className="silk">{label}</span>
      <ul className="tags" aria-label={label}>
        {items.map((t) => <li key={t} className="tag">{t}</li>)}
      </ul>
    </div>
  );
}

export default function DetailPanel({ result, onUseAsSeed }) {
  const { recommendation, score, breakdown, explanation = {}, alternatives = [], diagnostics = {}, candidatePool = {}, warnings = [] } = result;
  const preferenceWarnings = warnings.filter((w) => w.track === '(preferences)');
  const trackWarnings = warnings.filter((w) => w.track !== '(preferences)');
  return (
    <section className="detail" aria-labelledby="detail-h">
      <h3 id="detail-h" className="silk-h">Detail</h3>
      <p className="detail-score">
        Score <strong>{Number(score).toFixed(3)}</strong>
        {typeof recommendation.listeners === 'number' && <span> · {recommendation.listeners.toLocaleString()} listeners</span>}
      </p>
      <ScoreBreakdown breakdown={breakdown} />
      <TagList label="Matched tags" items={explanation.matchedTags} />
      <TagList label="Matched genres" items={explanation.matchedGenres} />
      {Array.isArray(explanation.sharedRelations) && explanation.sharedRelations.length > 0 && (
        <div className="detail-row">
          <span className="silk">Shared relations</span>
          <ul className="relations">
            {explanation.sharedRelations.map((r, i) => (
              <li key={i}><span className="relation-type">{r.type}</span> {r.value}{r.with && <span className="dim"> with {r.with}</span>}</li>
            ))}
          </ul>
        </div>
      )}
      {alternatives.length > 0 && (
        <div className="detail-row">
          <span className="silk">Alternatives · press to load as the newest seed</span>
          <ul className="alts">
            {alternatives.map((alt) => (
              <li key={`${alt.artist}|${alt.title}`}>
                <button type="button" className="alt" onClick={() => onUseAsSeed(alt)}>
                  <span className="alt-text"><strong>{alt.title}</strong> <span className="dim">{alt.artist}</span></span>
                  <span className="alt-score">{Number(alt.score).toFixed(3)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {preferenceWarnings.length > 0 && (
        <div className="notice" role="note">
          {preferenceWarnings.map((w, i) => <p key={i}>Strictness was bypassed for this pick: {w.issue}</p>)}
        </div>
      )}
      {trackWarnings.length > 0 && (
        <ul className="warnings" aria-label="Warnings">
          {trackWarnings.map((w, i) => <li key={i}>{w.track}: {w.issue}</li>)}
        </ul>
      )}
      <footer className="diag" aria-label="Diagnostics">
        <span>Latency {diagnostics.latencyMs ?? '?'} ms</span>
        <span>Cache {diagnostics.cacheHits ?? 0} hit / {diagnostics.cacheMisses ?? 0} miss</span>
        <span>Upstream {diagnostics.upstreamCalls ?? 0}</span>
        <span>Pool {candidatePool.mode || '?'} · {candidatePool.size ?? '?'} candidates · {candidatePool.scored ?? '?'} scored · {candidatePool.contrast ?? 0} contrast</span>
      </footer>
    </section>
  );
}
