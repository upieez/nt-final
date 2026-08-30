import SeedBuilder from './SeedBuilder.jsx';
import PreferencesPanel from './PreferencesPanel.jsx';
import RecommendPanel from './RecommendPanel.jsx';
import ResultCard from './ResultCard.jsx';
import useRecommendation from '../lib/useRecommendation.js';
import { addTrack, moveTrack, removeTrack } from '../lib/sequence.js';

export default function RecommendView({ sequence, setSequence, preferences, setPreferences, options, setOptions }) {
  const { loading, error, result, recommend, reset } = useRecommendation();

  const seedProps = {
    sequence,
    onAdd: (track) => setSequence((s) => addTrack(s, track)),
    onMove: (i, dir) => setSequence((s) => moveTrack(s, i, dir)),
    onRemove: (i) => setSequence((s) => removeTrack(s, i)),
    onClear: () => { setSequence([]); reset(); }
  };

  function useAsSeed(track) {
    setSequence((s) => addTrack(s, track));
    reset();
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      <SeedBuilder {...seedProps} />
      <PreferencesPanel preferences={preferences} options={options}
        onChange={setPreferences} onOptionsChange={setOptions} />
      <RecommendPanel canSubmit={sequence.length > 0} loading={loading} error={error}
        onSubmit={() => recommend(sequence, preferences, options)} />
      {result && <ResultCard result={result} onUseAsSeed={useAsSeed} />}
    </>
  );
}
