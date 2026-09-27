import { useEffect, useRef, useState } from 'react';
import Lcd from './Lcd.jsx';
import StudyCard from './StudyCard.jsx';
import Fader from './Fader.jsx';
import { postJson } from '../lib/api.js';
import { PRESET_SEQUENCES } from '../lib/presets.js';
import { divergenceFrom, similarityFrom } from '../lib/preferences.js';
import { allRatingsComplete, emptyRatings } from '../lib/study.js';
import { trackLabel } from '../lib/sequence.js';

const OWN = 'own';

function Consent({ onAgree, headingRef }) {
  return (
    <section className="plate" aria-labelledby="consent-h">
      <h2 id="consent-h" className="silk-h" ref={headingRef} tabIndex={-1}>Blind listening study</h2>
      <p>
        You will see a short sequence of tracks, then three candidate next tracks labelled A, B and C.
        One is chosen by NextTrack, one at random, and one is simply the most popular candidate. The
        order is shuffled and you are not told which is which.
      </p>
      <p>Rate each candidate on how well it follows, how fresh it feels, and whether you would let it play. Then submit.</p>
      <p className="notice">
        This is anonymous. No name, email, account, IP address or device identifier is recorded. Only
        your three ratings and the sequence you rated are stored, as one line in a study file used to
        evaluate the recommender. Nothing is stored in your browser.
      </p>
      <button type="button" className="key key-amber" onClick={onAgree}>I understand, start</button>
    </section>
  );
}

function SequencePicker({ ownSequence, onStart, loading, headingRef, divergence, onDivergenceChange }) {
  const [choice, setChoice] = useState(PRESET_SEQUENCES[0].id);
  const ownAvailable = ownSequence.length > 0;
  const chosen = choice === OWN ? ownSequence : PRESET_SEQUENCES.find((p) => p.id === choice).tracks;
  return (
    <section className="plate" aria-labelledby="pick-h">
      <h2 id="pick-h" className="silk-h" ref={headingRef} tabIndex={-1}>Pick a listening sequence</h2>
      <fieldset className="presets">
        <legend className="visually-hidden">Sequences</legend>
        <ul className="preset-list">
          {PRESET_SEQUENCES.map((p) => (
            <li key={p.id}>
              <label className={`preset${choice === p.id ? ' preset-on' : ''}`}>
                <input type="radio" name="preset" value={p.id} checked={choice === p.id} onChange={() => setChoice(p.id)} />
                <span className="lamp" aria-hidden="true" />
                <span className="preset-name">{p.name}</span>
                <span className="preset-tracks">{p.tracks.map(trackLabel).join(' / ')}</span>
              </label>
            </li>
          ))}
          <li>
            <label className={`preset${choice === OWN ? ' preset-on' : ''}${ownAvailable ? '' : ' preset-off'}`}>
              <input type="radio" name="preset" value={OWN} checked={choice === OWN} disabled={!ownAvailable} onChange={() => setChoice(OWN)} />
              <span className="lamp" aria-hidden="true" />
              <span className="preset-name">My own sequence</span>
              <span className="preset-tracks">{ownAvailable ? ownSequence.map(trackLabel).join(' / ') : 'load one on the Recommend panel first'}</span>
            </label>
          </li>
        </ul>
      </fieldset>
      <div className="bank bank-single">
        <Fader label="Similarity" value={similarityFrom(divergence)} fallback={1} low="Different" high="Similar"
          onChange={(v) => onDivergenceChange(divergenceFrom(v))}
          help="At the top the candidates are asked to be similar to the sequence, at the bottom to be different from it." />
      </div>
      <button type="button" className="key key-amber" disabled={loading} onClick={() => onStart(chosen)}>
        {loading ? 'Preparing three candidates...' : 'Get three candidates'}
      </button>
    </section>
  );
}

export default function StudyView({ sequence, preferences, health }) {
  const [stage, setStage] = useState('consent');
  const [trial, setTrial] = useState(null);
  const [trialSequence, setTrialSequence] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [divergence, setDivergence] = useState(preferences.divergence);
  const stageRef = useRef(null);

  useEffect(() => {
    if (stageRef.current) stageRef.current.focus();
  }, [stage]);

  async function startTrial(seq) {
    setLoading(true);
    setError(null);
    try {
      const prefs = { divergence, genreStrictness: preferences.genreStrictness, discoveryFactor: preferences.discoveryFactor };
      const body = await postJson('/api/v1/study/compare', { sequence: seq, preferences: prefs });
      setTrial(body);
      setTrialSequence(seq);
      setRatings(emptyRatings(body.items));
      setStage('rate');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await postJson('/api/v1/study/rate', { trialId: trial.trialId, ratings });
      setStage('thanks');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function nextSequence() {
    setTrial(null);
    setRatings({});
    setError(null);
    setStage('pick');
  }

  const messages = {
    consent: 'BLIND STUDY   ·   THREE CANDIDATES, ONE SEQUENCE, NO LABELS',
    pick: 'SELECT A SEQUENCE   ·   SET SIMILARITY   ·   PRESS GET THREE CANDIDATES',
    rate: `SEQ ${trialSequence.length}   ·   ${trialSequence.map((t, i) => `${i + 1}. ${trackLabel(t)}`).join('   ·   ')}   ·   RATE A, B AND C`,
    thanks: 'RATINGS RECORDED   ·   THANK YOU'
  };
  let status = { kind: 'message', text: messages[stage] };
  if (loading) status = { kind: 'loading' };
  else if (error) status = { kind: 'error', error };

  return (
    <>
      <Lcd status={status} health={health} />
      {stage === 'consent' && <Consent onAgree={() => setStage('pick')} headingRef={stageRef} />}
      {stage === 'pick' && (
        <SequencePicker ownSequence={sequence} onStart={startTrial} loading={loading}
          headingRef={stageRef} divergence={divergence} onDivergenceChange={setDivergence} />
      )}
      {stage === 'thanks' && (
        <section className="plate" aria-labelledby="thanks-h">
          <h2 id="thanks-h" className="silk-h" ref={stageRef} tabIndex={-1}>Thank you</h2>
          <p>Your ratings were recorded anonymously.</p>
          <button type="button" className="key key-amber" onClick={nextSequence}>Rate another sequence</button>
        </section>
      )}
      {stage === 'rate' && (
        <>
          <section className="plate" aria-labelledby="seq-h">
            <h2 id="seq-h" className="silk-h" ref={stageRef} tabIndex={-1}>The sequence you just heard</h2>
            <ol className="study-seq">
              {trialSequence.map((t) => <li key={trackLabel(t)}>{trackLabel(t)}</li>)}
            </ol>
            <p className="dim">Which of the three below should come next? Rate all three, then submit.</p>
          </section>
          <div className="study-grid">
            {trial.items.map((item) => (
              <StudyCard key={item.slot} item={item} rating={ratings[item.slot]}
                onChange={(r) => setRatings((prev) => ({ ...prev, [item.slot]: r }))} />
            ))}
          </div>
          <section className="plate plate-row">
            <button type="button" className="key key-amber" disabled={!allRatingsComplete(ratings) || loading} onClick={submit}>
              {loading ? 'Submitting...' : 'Submit ratings'}
            </button>
            <span role="status" className="silk silk-dim">{!allRatingsComplete(ratings) && 'Rate every option to enable submit'}</span>
            <button type="button" className="key" onClick={nextSequence}>Skip this sequence</button>
          </section>
        </>
      )}
    </>
  );
}
