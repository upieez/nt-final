import { MAX_SEQUENCE } from '../lib/sequence.js';
import TrackSearch from './TrackSearch.jsx';
import ManualAddForm from './ManualAddForm.jsx';
import SequenceList from './SequenceList.jsx';

export default function SeedBuilder({ sequence, onAdd, onMove, onRemove, onClear }) {
  const full = sequence.length >= MAX_SEQUENCE;
  return (
    <section className="panel" aria-labelledby="seed-heading">
      <div className="panel-head">
        <h2 id="seed-heading">1. What did you just listen to?</h2>
        <span className="muted small">{sequence.length} / {MAX_SEQUENCE} tracks</span>
      </div>
      <p className="muted small">
        Order matters: the last track in the list counts most. Up to {MAX_SEQUENCE} tracks.
      </p>
      <SequenceList sequence={sequence} onMove={onMove} onRemove={onRemove} />
      {sequence.length > 0 && (
        <button type="button" className="btn btn-link" onClick={onClear}>Clear sequence</button>
      )}
      {full && <p className="notice">Sequence is full. Remove a track to add another.</p>}
      <TrackSearch onAdd={onAdd} disabled={full} />
      <ManualAddForm onAdd={onAdd} disabled={full} />
    </section>
  );
}
