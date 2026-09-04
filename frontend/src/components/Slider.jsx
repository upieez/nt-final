import { useId } from 'react';
import { clamp01 } from '../lib/preferences.js';

export default function Slider({ label, value, onChange, lowCaption, highCaption, help, fallback = 0.5, midpoint }) {
  const id = useId();
  const helpId = `${id}-help`;
  const clamped = clamp01(value, fallback);
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id} className="label">{label}</label>
        <output htmlFor={id} className="slider-value">{clamped.toFixed(2)}</output>
      </div>
      <div className={`slider-track${midpoint ? ' slider-track-midpoint' : ''}`}>
        <input
          id={id}
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={clamped}
          onChange={(e) => onChange(clamp01(e.target.value, fallback))}
          aria-describedby={helpId}
          list={midpoint ? `${id}-marks` : undefined}
        />
        {midpoint && (
          <datalist id={`${id}-marks`}>
            <option value="0.5" label={midpoint} />
          </datalist>
        )}
      </div>
      <div className="slider-captions" aria-hidden="true">
        <span>{lowCaption}</span>
        {midpoint && <span className="slider-midpoint-label">{midpoint}</span>}
        <span>{highCaption}</span>
      </div>
      <p id={helpId} className="small muted">{help}</p>
    </div>
  );
}
