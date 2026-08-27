import { useEffect, useRef, useState } from 'react';
import StudyCard from './StudyCard.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { postJson } from '../lib/api.js';
import { PRESET_SEQUENCES } from '../lib/presets.js';
import { allRatingsComplete, emptyRatings } from '../lib/study.js';
import { trackLabel } from '../lib/sequence.js';

const OWN = 'own';

function Consent({ onAgree }) {
  return (
    <section className="panel" aria-labelledby="consent-h">
      <h2 id="consent-h">Blind listening study</h2>
      <p>
        You will hear a short sequence of tracks, then three candidate next tracks labelled A, B and C.
        One is chosen by NextTrack, one at random, and one is simply the most popular candidate. The
        order is shuffled and you are not told which is which.
      </p>
      <p>
        Rate each candidate on how well it follows, how fresh it feels, and whether you would let it
        play. Then submit.
      </p>
      <p className="notice">
        This is anonymous. No name, email, account, IP address or device identifier is recorded. Only
        your three ratings and the sequence you rated are stored, as one line in a study file used to
        evaluate the recommender. Nothing is stored in your browser.
      </p>
      <button type="button" className="btn btn-primary" onClick={onAgree}>I understand, start</button>
    </section>
  );
}

function SequencePicker({ ownSequence, onStart, loading, error, headingRef }) {
  const [choice, setChoice] = useState(PRESET_SEQUENCES[0].id);
  const ownAvailable = ownSequence.length > 0;
  const chosen = choice === OWN ? ownSequence : PRESET_SEQUENCES.find((p) => p.id === choice).tracks;

  return (
    <section className="panel" aria-labelledby="pick-h">
      <h2 id="pick-h" ref={headingRef} tabIndex={-1}>Pick a listening sequence</h2>
      <fieldset className="scale">
        <legend className="label">Sequences</legend>
        <ul className="preset-list">
          {PRESET_SEQUENCES.map((p) => (
            <li key={p.id}>
              <label className="preset-option">
                <input type="radio" name="preset" value={p.id} checked={choice === p.id} onChange={() => setChoice(p.id)} />
                <span><strong>{p.name}</strong> <span className="muted small">{p.tracks.map(trackLabel).join(' / ')}</span></span>
              </label>
            </li>
          ))}
          <li>
            <label className="preset-option">
              <input type="radio" name="preset" value={OWN} checked={choice === OWN} disabled={!ownAvailable} onChange={() => setChoice(OWN)} />
              <span>
                <strong>My own sequence</strong>{' '}
                <span className="muted small">
                  {ownAvailable ? ownSequence.map(trackLabel).join(' / ') : 'build one on the Recommend tab first'}
                </span>
              </span>
            </label>
          </li>
        </ul>
      </fieldset>
      <button type="button" className="btn btn-primary" disabled={loading} onClick={() => onStart(chosen)}>
        {loading ? 'Preparing three candidates...' : 'Get three candidates'}
      </button>
      <ErrorMessage error={error} />
    </section>
  );
}

export default function StudyView({ sequence, preferences }) {
  const [stage, setStage] = useState('consent');
  const [trial, setTrial] = useState(null);
  const [trialSequence, setTrialSequence] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const stageRef = useRef(null);

  useEffect(() => {
    if (stageRef.current) stageRef.current.focus();
  }, [stage]);

  async function startTrial(seq) {
    setLoading(true);
    setError(null);
    try {
      const prefs = { genreStrictness: preferences.genreStrictness, discoveryFactor: preferences.discoveryFactor };
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

  if (stage === 'consent') return <Consent onAgree={() => setStage('pick')} />;
  if (stage === 'pick') {
    return <SequencePicker ownSequence={sequence} onStart={startTrial} loading={loading} error={error} headingRef={stageRef} />;
  }
  if (stage === 'thanks') {
    return (
      <section className="panel" aria-labelledby="thanks-h">
        <h2 id="thanks-h" ref={stageRef} tabIndex={-1}>Thank you</h2>
        <p>Your ratings were recorded anonymously.</p>
        <button type="button" className="btn btn-primary" onClick={nextSequence}>Rate another sequence</button>
      </section>
    );
  }

  return (
    <>
      <section className="panel" aria-labelledby="seq-h">
        <h2 id="seq-h" ref={stageRef} tabIndex={-1}>The sequence you just heard</h2>
        <ol className="study-seq">
          {trialSequence.map((t) => <li key={trackLabel(t)}>{trackLabel(t)}</li>)}
        </ol>
        <p className="small muted">Which of the three below should come next? Rate all three, then submit.</p>
      </section>
      <div className="study-grid">
        {trial.items.map((item) => (
          <StudyCard key={item.slot} item={item} rating={ratings[item.slot]}
            onChange={(r) => setRatings((prev) => ({ ...prev, [item.slot]: r }))} />
        ))}
      </div>
      <section className="panel">
        <div className="field-row">
          <button type="button" className="btn btn-primary" disabled={!allRatingsComplete(ratings) || loading} onClick={submit}>
            {loading ? 'Submitting...' : 'Submit ratings'}
          </button>
          <span role="status" className="muted small">
            {!allRatingsComplete(ratings) && 'Rate every option to enable submit.'}
          </span>
          <button type="button" className="btn btn-link" onClick={nextSequence}>Skip this sequence</button>
        </div>
        <ErrorMessage error={error} />
      </section>
    </>
  );
}
