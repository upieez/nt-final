import Slider from './Slider.jsx';
import { strictnessIgnored } from '../lib/preferences.js';

export default function DivergenceSlider({ value, onChange }) {
  const ignored = strictnessIgnored({ divergence: value });
  return (
    <Slider
      label="Similar or different?"
      value={value}
      fallback={0}
      onChange={onChange}
      lowCaption="Similar to what I just played"
      highCaption="Something completely different"
      midpoint="midpoint"
      help={ignored
        ? 'Past the midpoint, so the genre strictness setting below is ignored and candidates from unrelated genres are pulled in.'
        : 'Past the midpoint the genre strictness setting below is ignored and candidates from unrelated genres are pulled in.'}
    />
  );
}
