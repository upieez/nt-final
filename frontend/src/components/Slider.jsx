import { useId } from 'react';
import { clamp01 } from '../lib/preferences.js';

export default function Slider({ label, value, onChange, lowCaption, highCaption, help }) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id} className="label">{label}</label>
        <output htmlFor={id} className="slider-value">{clamp01(value).toFixed(2)}</output>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={clamp01(value)}
        onChange={(e) => onChange(clamp01(e.target.value))}
        aria-describedby={helpId}
      />
      <div className="slider-captions" aria-hidden="true">
        <span>{lowCaption}</span>
        <span>{highCaption}</span>
      </div>
      <p id={helpId} className="small muted">{help}</p>
    </div>
  );
}
