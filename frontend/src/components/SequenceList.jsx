import { trackLabel } from '../lib/sequence.js';

export default function SequenceList({ sequence, onMove, onRemove }) {
  if (sequence.length === 0) {
    return <p className="muted">Nothing yet. Add at least one track to get a recommendation.</p>;
  }
  const last = sequence.length - 1;
  return (
    <ol className="sequence" aria-label="Listening sequence, oldest first">
      {sequence.map((track, i) => (
        <li key={`${track.artist}|${track.title}`} className={`sequence-item${i === last ? ' sequence-item-recent' : ''}`}>
          <span className="sequence-index" aria-hidden="true">{i + 1}</span>
          <span className="sequence-text">
            <strong>{track.title}</strong> <span className="muted">by {track.artist}</span>
            {i === last && <span className="badge">most recent</span>}
          </span>
          <span className="sequence-actions">
            <button type="button" className="btn btn-icon" disabled={i === 0}
              onClick={() => onMove(i, -1)} aria-label={`Move ${trackLabel(track)} up`}>
              &#9650;
            </button>
            <button type="button" className="btn btn-icon" disabled={i === last}
              onClick={() => onMove(i, 1)} aria-label={`Move ${trackLabel(track)} down`}>
              &#9660;
            </button>
            <button type="button" className="btn btn-icon btn-danger"
              onClick={() => onRemove(i)} aria-label={`Remove ${trackLabel(track)}`}>
              &#10005;
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
