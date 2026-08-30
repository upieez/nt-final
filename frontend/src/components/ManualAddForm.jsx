import { useId, useState } from 'react';

export default function ManualAddForm({ onAdd, disabled }) {
  const artistId = useId();
  const titleId = useId();
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const canSubmit = artist.trim() && title.trim() && !disabled;

  function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onAdd({ artist, title });
    setArtist('');
    setTitle('');
  }

  return (
    <form className="manual-add" onSubmit={submit} aria-label="Add a track by hand">
      <p className="small muted">Not listed? Type the artist and title yourself.</p>
      <div className="field-row">
        <div className="field">
          <label htmlFor={artistId} className="label">Artist</label>
          <input id={artistId} className="input" value={artist} maxLength={200}
            onChange={(e) => setArtist(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={titleId} className="label">Title</label>
          <input id={titleId} className="input" value={title} maxLength={200}
            onChange={(e) => setTitle(e.target.value)} />
        </div>
        <button type="submit" className="btn" disabled={!canSubmit}>Add to sequence</button>
      </div>
    </form>
  );
}
