import { useId } from 'react';
import YouTubePlayer from './YouTubePlayer.jsx';
import { SCALE } from '../lib/study.js';

function ScaleGroup({ name, label, value, onChange, low, high }) {
  const id = useId();
  return (
    <fieldset className="scale">
      <legend className="label">{label} <span className="visually-hidden">(1 is {low}, 5 is {high})</span></legend>
      <div className="scale-options">
        {SCALE.map((n) => (
          <label key={n} className={`scale-option${value === n ? ' scale-option-on' : ''}`}>
            <input type="radio" name={`${id}-${name}`} value={n} checked={value === n}
              onChange={() => onChange(n)} />
            <span>{n}</span>
          </label>
        ))}
      </div>
      <div className="slider-captions" aria-hidden="true"><span>{low}</span><span>{high}</span></div>
    </fieldset>
  );
}

export default function StudyCard({ item, rating, onChange }) {
  const id = useId();
  function set(key, value) {
    onChange({ ...rating, [key]: value });
  }
  return (
    <article className="panel study-card" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>Option {item.slot}</h3>
      <p className="result-title">{item.title}</p>
      <p className="result-artist">by {item.artist}</p>
      <YouTubePlayer track={item} compact />
      <ScaleGroup name="coherence" label="Does it follow naturally from the sequence?"
        value={rating.coherence} onChange={(v) => set('coherence', v)} low="Jarring" high="Seamless" />
      <ScaleGroup name="novelty" label="How fresh or surprising is it?"
        value={rating.novelty} onChange={(v) => set('novelty', v)} low="Predictable" high="Surprising" />
      <fieldset className="scale">
        <legend className="label">Would you let it play?</legend>
        <div className="scale-options">
          <label className={`scale-option${rating.wouldPlay === true ? ' scale-option-on' : ''}`}>
            <input type="radio" name={`${id}-play`} checked={rating.wouldPlay === true} onChange={() => set('wouldPlay', true)} />
            <span>Yes</span>
          </label>
          <label className={`scale-option${rating.wouldPlay === false ? ' scale-option-on' : ''}`}>
            <input type="radio" name={`${id}-play`} checked={rating.wouldPlay === false} onChange={() => set('wouldPlay', false)} />
            <span>No</span>
          </label>
        </div>
      </fieldset>
    </article>
  );
}
