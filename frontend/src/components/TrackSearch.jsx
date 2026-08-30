import { useEffect, useId, useState } from 'react';
import { searchTracks } from '../lib/api.js';
import useDebouncedValue from '../lib/useDebouncedValue.js';

const MIN_QUERY = 2;

export default function TrackSearch({ onAdd, disabled }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
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

  return (
    <div className="search">
      <label htmlFor={inputId} className="label">Search for a track</label>
      <input
        id={inputId}
        type="search"
        className="input"
        placeholder="e.g. Joy Division Disorder"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      <div className="search-status" role="status" aria-live="polite">
        {status === 'loading' && 'Searching...'}
        {status === 'error' && 'Search failed. You can still add the track by hand below.'}
        {status === 'offline' && 'Could not reach the server. Is the backend running?'}
        {status === 'done' && results.length === 0 && 'No matches. Try the manual form below.'}
        {status === 'done' && results.length > 0 && `${results.length} matches`}
      </div>
      {results.length > 0 && (
        <ul className="search-results" aria-label="Search results">
          {results.map((r) => (
            <li key={`${r.artist}|${r.title}`} className="search-result">
              <span className="search-result-text">
                <strong>{r.title}</strong> <span className="muted">by {r.artist}</span>
                {typeof r.listeners === 'number' && (
                  <span className="muted small"> ({r.listeners.toLocaleString()} listeners)</span>
                )}
              </span>
              <button
                type="button"
                className="btn btn-small"
                disabled={disabled}
                onClick={() => onAdd({ artist: r.artist, title: r.title })}
                aria-label={`Add ${r.title} by ${r.artist} to the sequence`}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
