import ScoreBreakdown from './ScoreBreakdown.jsx';
import YouTubePlayer from './YouTubePlayer.jsx';

function TagList({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="taglist">
      <span className="taglist-label">{label}</span>
      <ul className="chips chips-inline" aria-label={label}>
        {items.map((t) => <li key={t} className="chip chip-small">{t}</li>)}
      </ul>
    </div>
  );
}

export default function ResultCard({ result, onUseAsSeed }) {
  const { recommendation, score, breakdown, explanation = {}, alternatives = [], diagnostics = {}, candidatePool = {}, warnings = [] } = result;
  return (
    <section className="panel result" aria-labelledby="result-heading">
      <h2 id="result-heading">Play next</h2>
      <div className="result-main">
        <p className="result-title">{recommendation.title}</p>
        <p className="result-artist">by {recommendation.artist}</p>
        <p className="result-score">
          Score <strong>{Number(score).toFixed(3)}</strong>
          {typeof recommendation.listeners === 'number' && (
            <span className="muted"> · {recommendation.listeners.toLocaleString()} listeners</span>
          )}
        </p>
        {explanation.summary && <p className="result-summary">{explanation.summary}</p>}
        <button type="button" className="btn btn-small" onClick={() => onUseAsSeed(recommendation)}>
          Add to my sequence and continue
        </button>
      </div>

      <YouTubePlayer track={recommendation} />

      <TagList label="Matched tags" items={explanation.matchedTags} />
      <TagList label="Matched genres" items={explanation.matchedGenres} />
      {Array.isArray(explanation.sharedRelations) && explanation.sharedRelations.length > 0 && (
        <div className="taglist">
          <span className="taglist-label">Shared relations</span>
          <ul className="relations">
            {explanation.sharedRelations.map((r, i) => (
              <li key={i}>
                <span className="relation-type">{r.type}</span> {r.value}
                {r.with && <span className="muted"> with {r.with}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ScoreBreakdown breakdown={breakdown} />

      {alternatives.length > 0 && (
        <div className="alternatives">
          <h3>Alternatives</h3>
          <p className="small muted">Prefer one of these? Click it to add it as your newest seed.</p>
          <ul className="alt-list">
            {alternatives.map((alt) => (
              <li key={`${alt.artist}|${alt.title}`}>
                <button type="button" className="alt-btn" onClick={() => onUseAsSeed(alt)}>
                  <span className="alt-text"><strong>{alt.title}</strong> <span className="muted">by {alt.artist}</span></span>
                  <span className="alt-score">{Number(alt.score).toFixed(3)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="warnings" aria-label="Warnings">
          {warnings.map((w, i) => <li key={i}>{w.track}: {w.issue}</li>)}
        </ul>
      )}

      <footer className="diagnostics">
        <span>Latency {diagnostics.latencyMs ?? '?'} ms</span>
        <span>Cache hits {diagnostics.cacheHits ?? 0} / misses {diagnostics.cacheMisses ?? 0}</span>
        <span>Upstream calls {diagnostics.upstreamCalls ?? 0}</span>
        <span>Pool {candidatePool.mode || '?'}, {candidatePool.size ?? '?'} candidates, {candidatePool.scored ?? '?'} scored</span>
      </footer>
    </section>
  );
}
