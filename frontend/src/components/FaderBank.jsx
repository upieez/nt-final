import Fader from './Fader.jsx';
import { divergenceFrom, similarityFrom, strictnessIgnored } from '../lib/preferences.js';

// locked: scan in progress
export default function FaderBank({ preferences, onChange, locked = false }) {
  const bypass = strictnessIgnored(preferences);
  function set(key, value) {
    onChange({ ...preferences, [key]: value });
  }
  return (
    <section className="bank" aria-labelledby="bank-h">
      <h2 id="bank-h" className="visually-hidden">Preferences</h2>
      <Fader label="Similarity" value={similarityFrom(preferences.divergence)} fallback={1} disabled={locked}
        onChange={(v) => set('divergence', divergenceFrom(v))} low="Different" high="Similar"
        help="At the top the most similar candidate wins. Below the midpoint the least similar one does and strictness is bypassed." />
      <Fader label="Discovery" value={preferences.discoveryFactor} disabled={locked}
        onChange={(v) => set('discoveryFactor', v)} low="Hits" high="Deep cuts"
        help="Higher values penalise very popular tracks so lesser-known ones can win." />
      <Fader label="Strictness" value={preferences.genreStrictness} bypassed={bypass} disabled={locked}
        onChange={(v) => set('genreStrictness', v)} low="Loose" high="Strict"
        help="Higher values drop candidates that share no genre or tag with your most recent seed." />
    </section>
  );
}
