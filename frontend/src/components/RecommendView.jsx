import { useState } from 'react';
import Lcd from './Lcd.jsx';
import SeedRack from './SeedRack.jsx';
import SearchDeck, { useTrackSearch } from './SearchDeck.jsx';
import FaderBank from './FaderBank.jsx';
import PlayButton from './PlayButton.jsx';
import Tray from './Tray.jsx';
import useRecommendation from '../lib/useRecommendation.js';
import { primeArt } from '../lib/useArt.js';
import { addTrack, moveTrack, removeTrack } from '../lib/sequence.js';

export default function RecommendView({ sequence, setSequence, preferences, setPreferences, options, health }) {
  const { loading, error, result, recommend, reset } = useRecommendation();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const search = useTrackSearch(searching ? query : '');

  function closeSearch() {
    setSearching(false);
    setQuery('');
  }

  function add(track) {
    if (track.image) primeArt(track, track.image);
    setSequence((s) => addTrack(s, track));
    reset();
    closeSearch();
  }

  function useAsSeed(track) {
    add(track);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  let status = { kind: 'idle' };
  if (loading) status = { kind: 'loading' };
  else if (error) status = { kind: 'error', error };
  else if (result) status = { kind: 'message', text: `NOW LOADED: ${result.recommendation.artist} - ${result.recommendation.title}` };
  else if (sequence.length > 0) status = { kind: 'seeds', sequence };

  const hint = sequence.length === 0 ? 'Add a seed track first' : loading ? 'Gathering and scoring candidates' : `${sequence.length} seed${sequence.length === 1 ? '' : 's'} loaded`;

  return (
    <>
      <Lcd status={status} health={health}
        search={searching ? { value: query, onChange: setQuery, onClose: closeSearch, status: search.status, count: search.results.length } : null} />
      {searching && <SearchDeck results={search.results} status={search.status} onAdd={add} onClose={closeSearch} />}
      <SeedRack sequence={sequence} adding={searching} locked={loading}
        onMove={(i, dir) => { setSequence((s) => moveTrack(s, i, dir)); reset(); }}
        onRemove={(i) => { setSequence((s) => removeTrack(s, i)); reset(); }}
        onAddRequest={() => (searching ? closeSearch() : setSearching(true))} />
      <div className="desk">
        <FaderBank preferences={preferences} onChange={setPreferences} locked={loading} />
        <PlayButton disabled={sequence.length === 0} loading={loading} hint={hint}
          onClick={() => recommend(sequence, preferences, options)} />
      </div>
      <Tray result={result} onUseAsSeed={useAsSeed} />
    </>
  );
}
