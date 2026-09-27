import { useEffect, useId, useState } from 'react';
import { searchTracks } from '../lib/api.js';
import useDebouncedValue from '../lib/useDebouncedValue.js';

const MIN_QUERY = 2;

// Owns the search request
export function useTrackSearch(query) {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const debounced = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    if (debounced.length < MIN_QUERY) {
      setResults([]);
      setStatus('idle');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');
    searchTracks(debounced, controller.signal)
      .then((body) => {
        setResults(Array.isArray(body.results) ? body.results : []);
        setStatus('done');
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setResults([]);
        setStatus(err.status === 0 ? 'offline' : 'error');
      });
    return () => controller.abort();
  }, [debounced]);

  return { results, status };
}

function ManualEntry({ onAdd }) {
  const artistId = useId();
  const titleId = useId();
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const can = artist.trim() && title.trim();
  function submit(e) {
    e.preventDefault();
    if (!can) return;
    onAdd({ artist, title });
    setArtist('');
    setTitle('');
  }
  return (
    <form className="manual" onSubmit={submit} aria-label="Add a track by hand">
      <div className="manual-field">
        <label htmlFor={artistId} className="silk">Artist</label>
        <input id={artistId} className="lcd-field" value={artist} maxLength={200} onChange={(e) => setArtist(e.target.value)} />
      </div>
      <div className="manual-field">
        <label htmlFor={titleId} className="silk">Title</label>
        <input id={titleId} className="lcd-field" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <button type="submit" className="key" disabled={!can}>Load</button>
    </form>
  );
}

export default function SearchDeck({ results, status, onAdd, onClose }) {
  const [manual, setManual] = useState(false);
  return (
    <div className="deck" aria-label="Search results">
      {results.length > 0 && (
        <ul className="deck-list">
          {results.map((r, i) => (
            <li key={`${r.artist}|${r.title}`}>
              <button type="button" className="deck-row" onClick={() => onAdd({ artist: r.artist, title: r.title })}
                aria-label={`Load ${r.title} by ${r.artist}`}>
                <span className="deck-idx" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span className="deck-title">{r.title}</span>
                <span className="deck-artist">{r.artist}</span>
                {typeof r.listeners === 'number' && <span className="deck-meta">{r.listeners.toLocaleString()}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {status === 'done' && results.length === 0 && <p className="deck-note">NO MATCH. USE MANUAL ENTRY.</p>}
      {status === 'error' && <p className="deck-note">SEARCH FAILED. USE MANUAL ENTRY.</p>}
      {status === 'offline' && <p className="deck-note">NO LINK TO SERVER.</p>}
      <div className="deck-keys">
        <button type="button" className={`key key-small${manual ? ' key-on' : ''}`} aria-pressed={manual} onClick={() => setManual((m) => !m)}>Manual</button>
        <button type="button" className="key key-small" onClick={onClose}>Close</button>
      </div>
      {manual && <ManualEntry onAdd={onAdd} />}
    </div>
  );
}
