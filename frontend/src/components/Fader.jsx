import { useId } from 'react';
import { clamp01 } from '../lib/preferences.js';

// One fader channel
export default function Fader({ label, value, onChange, low, high, bypassed = false, disabled = false, fallback = 0.5, help }) {
  const id = useId();
  const helpId = `${id}-help`;
  const clamped = clamp01(value, fallback);
  return (
    <div className={`fader${bypassed ? ' fader-bypassed' : ''}${disabled ? ' fader-locked' : ''}`}>
      <label htmlFor={id} className="fader-label">{label}</label>
      <div className="fader-scale" aria-hidden="true">
        <span className="fader-cap">{high}</span>
        <span className="fader-cap fader-cap-low">{low}</span>
      </div>
      <div className="fader-track">
        <input id={id} type="range" min="0" max="1" step="0.05" value={clamped} disabled={disabled}
          onChange={(e) => onChange(clamp01(e.target.value, fallback))}
          aria-describedby={help ? helpId : undefined}
          aria-valuetext={bypassed ? `${clamped.toFixed(2)}, bypassed` : clamped.toFixed(2)} />
      </div>
      <div className="fader-readout">
        <output htmlFor={id} className="readout">{bypassed ? '--' : clamped.toFixed(2)}</output>
        <span className={`lamp-row${bypassed ? ' lamp-row-on' : ''}`} aria-hidden="true">
          <span className="lamp lamp-amber" />Bypass
        </span>
      </div>
      {help && <p id={helpId} className="visually-hidden">{help}</p>}
    </div>
  );
}
