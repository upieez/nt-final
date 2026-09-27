import { useId } from 'react';
import AlbumArt from './AlbumArt.jsx';
import YouTubePlayer from './YouTubePlayer.jsx';
import { SCALE } from '../lib/study.js';

function ScaleGroup({ name, label, value, onChange, low, high }) {
  const id = useId();
  return (
    <fieldset className="scale">
      <legend className="silk">{label} <span className="visually-hidden">(1 is {low}, 5 is {high})</span></legend>
      <div className="keypad">
        {SCALE.map((n) => (
          <label key={n} className={`keycap${value === n ? ' keycap-on' : ''}`}>
            <input type="radio" name={`${id}-${name}`} value={n} checked={value === n} onChange={() => onChange(n)} />
            <span>{n}</span>
          </label>
        ))}
      </div>
      <div className="scale-caps" aria-hidden="true"><span>{low}</span><span>{high}</span></div>
    </fieldset>
  );
}

export default function StudyCard({ item, rating, onChange }) {
  const id = useId();
  function set(key, value) {
    onChange({ ...rating, [key]: value });
  }
  return (
    <article className="tray tray-static study-tray" aria-labelledby={`${id}-h`}>
      <div className="tray-inner">
        <div className="tray-art"><AlbumArt track={item} size="large" /></div>
        <div className="tray-text">
          <h3 id={`${id}-h`} className="silk">Option {item.slot}</h3>
          <p className="tray-title">{item.title}</p>
          <p className="tray-artist">{item.artist}</p>
          <YouTubePlayer track={item} compact />
        </div>
      </div>
      <div className="study-scales">
        <ScaleGroup name="coherence" label="Does it follow naturally?" value={rating.coherence}
          onChange={(v) => set('coherence', v)} low="Jarring" high="Seamless" />
        <ScaleGroup name="novelty" label="How fresh is it?" value={rating.novelty}
          onChange={(v) => set('novelty', v)} low="Predictable" high="Surprising" />
        <fieldset className="scale">
          <legend className="silk">Would you let it play?</legend>
          <div className="keypad">
            <label className={`keycap keycap-wide${rating.wouldPlay === true ? ' keycap-on' : ''}`}>
              <input type="radio" name={`${id}-play`} checked={rating.wouldPlay === true} onChange={() => set('wouldPlay', true)} />
              <span>Yes</span>
            </label>
            <label className={`keycap keycap-wide${rating.wouldPlay === false ? ' keycap-on' : ''}`}>
              <input type="radio" name={`${id}-play`} checked={rating.wouldPlay === false} onChange={() => set('wouldPlay', false)} />
              <span>No</span>
            </label>
          </div>
        </fieldset>
      </div>
    </article>
  );
}
