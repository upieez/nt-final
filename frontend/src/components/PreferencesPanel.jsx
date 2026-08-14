import { useId, useState } from 'react';
import Slider from './Slider.jsx';
import { addExcludedArtist } from '../lib/preferences.js';

export default function PreferencesPanel({ preferences, options, onChange, onOptionsChange }) {
  const genreId = useId();
  const excludeId = useId();
  const poolId = useId();
  const [excludeDraft, setExcludeDraft] = useState('');

  function set(key, value) {
    onChange({ ...preferences, [key]: value });
  }

  function addExclude(e) {
    e.preventDefault();
    set('excludeArtists', addExcludedArtist(preferences.excludeArtists, excludeDraft));
    setExcludeDraft('');
  }

  function removeExclude(name) {
    set('excludeArtists', preferences.excludeArtists.filter((a) => a !== name));
  }

  return (
    <section className="panel" aria-labelledby="prefs-heading">
      <h2 id="prefs-heading">2. How adventurous should it be?</h2>
      <div className="prefs-grid">
        <Slider
          label="Genre strictness"
          value={preferences.genreStrictness}
          onChange={(v) => set('genreStrictness', v)}
          lowCaption="Anything goes"
          highCaption="Stay in the genre"
          help="Higher values drop candidates that do not share a genre or tag with your sequence."
        />
        <Slider
          label="Discovery"
          value={preferences.discoveryFactor}
          onChange={(v) => set('discoveryFactor', v)}
          lowCaption="Familiar hits"
          highCaption="Deep cuts"
          help="Higher values penalise very popular tracks so lesser-known ones can win."
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={genreId} className="label">Target genre (optional)</label>
          <input id={genreId} className="input" value={preferences.targetGenre} maxLength={100}
            placeholder="e.g. post-punk" onChange={(e) => set('targetGenre', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={poolId} className="label">Candidate pool</label>
          <select id={poolId} className="input" value={options.poolMode}
            onChange={(e) => onOptionsChange({ ...options, poolMode: e.target.value })}>
            <option value="dynamic">Dynamic (gathered per request from similar tracks)</option>
            <option value="fixed">Fixed (built-in sample pool, faster)</option>
          </select>
        </div>
      </div>
      <form className="exclude" onSubmit={addExclude} aria-label="Exclude artists">
        <label htmlFor={excludeId} className="label">Exclude artists (optional)</label>
        <div className="field-row">
          <input id={excludeId} className="input field" value={excludeDraft} maxLength={200}
            placeholder="Artist name, then press Enter" onChange={(e) => setExcludeDraft(e.target.value)} />
          <button type="submit" className="btn btn-small" disabled={!excludeDraft.trim()}>Exclude</button>
        </div>
        {preferences.excludeArtists.length > 0 && (
          <ul className="chips" aria-label="Excluded artists">
            {preferences.excludeArtists.map((name) => (
              <li key={name} className="chip">
                {name}
                <button type="button" className="chip-remove" onClick={() => removeExclude(name)}
                  aria-label={`Stop excluding ${name}`}>&#10005;</button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </section>
  );
}
