import ErrorMessage from './ErrorMessage.jsx';

export default function RecommendPanel({ canSubmit, loading, error, onSubmit }) {
  return (
    <section className="panel" aria-labelledby="go-heading">
      <h2 id="go-heading">3. Ask NextTrack</h2>
      <div className="field-row">
        <button type="button" className="btn btn-primary" disabled={!canSubmit || loading} onClick={onSubmit}>
          {loading ? 'Thinking...' : 'Recommend the next track'}
        </button>
        {!canSubmit && <span className="muted small">Add at least one track first.</span>}
      </div>
      <div role="status" aria-live="polite" className="small muted">
        {loading && 'Gathering candidates and scoring them. Live lookups can take a few seconds.'}
      </div>
      <ErrorMessage error={error} />
    </section>
  );
}
