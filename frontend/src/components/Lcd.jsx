import { useId } from 'react';
import { trackLabel } from '../lib/sequence.js';
import { describeError } from '../lib/errors.js';

function Ticker({ text }) {
  // Duplicated for seamless looping
  // Speed scales with length
  const seconds = Math.max(14, Math.round(text.length / 5));
  return (
    <div className="lcd-ticker" style={{ '--ticker-s': `${seconds}s` }}>
      <span className="lcd-ticker-text">{text}</span>
      <span className="lcd-ticker-text" aria-hidden="true">{text}</span>
    </div>
  );
}

function healthText(health) {
  if (!health) return null;
  if (health.state === 'checking') return { text: 'LINK ..', tone: 'dim' };
  if (health.state === 'down') return { text: 'NO LINK', tone: 'err' };
  return health.offline ? { text: 'OFFLINE MODE', tone: 'warn' } : { text: 'LINK OK', tone: 'ok' };
}

// Status display and search field
export default function Lcd({ status, search, health, label = 'Display' }) {
  const inputId = useId();
  const link = healthText(health);

  let body;
  let kind = status?.kind || 'idle';
  if (search) {
    kind = 'search';
    body = (
      <div className="lcd-search">
        <label htmlFor={inputId} className="visually-hidden">Search for a track</label>
        <span className="lcd-prompt" aria-hidden="true">&gt;</span>
        <input id={inputId} type="search" className="lcd-input" value={search.value} autoFocus autoComplete="off"
          placeholder="TYPE ARTIST OR TITLE" onChange={(e) => search.onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') search.onClose(); }} />
        <span className="lcd-count" role="status" aria-live="polite">
          {search.status === 'loading' && 'SEARCHING'}
          {search.status === 'done' && `${search.count} HIT${search.count === 1 ? '' : 'S'}`}
          {search.status === 'error' && 'SEARCH ERR'}
          {search.status === 'offline' && 'NO LINK'}
        </span>
      </div>
    );
  } else if (kind === 'loading') {
    body = (
      <div className="lcd-scan" role="status" aria-live="polite">
        <span className="lcd-scan-text">SCANNING</span>
        <span className="lcd-scan-bar" aria-hidden="true" />
      </div>
    );
  } else if (kind === 'error') {
    const { headline, details } = describeError(status.error);
    body = (
      <div className="lcd-error" role="alert">
        <span className="lcd-err-flag">ERR</span>
        <span className="lcd-err-text">{headline}{details.length > 0 ? ` (${details[0]})` : ''}</span>
      </div>
    );
  } else if (kind === 'seeds') {
    const seq = status.sequence || [];
    const text = seq.map((t, i) => `${i + 1}. ${trackLabel(t)}`).join('   ·   ');
    body = <Ticker text={`SEQ ${seq.length}/5   ·   ${text}   ·   `} />;
  } else if (kind === 'message') {
    body = <Ticker text={`${status.text}   ·   `} />;
  } else {
    body = <Ticker text="INSERT TRACK   ·   PRESS + TO ADD UP TO 5 SEED TRACKS   ·   THEN PRESS PLAY   ·   " />;
  }

  return (
    <div className={`lcd lcd-mode-${kind}`} aria-label={label}>
      <div className="lcd-glass">
        <div className="lcd-main">{body}</div>
        {link && <span className={`lcd-link lcd-link-${link.tone}`}>{link.text}</span>}
      </div>
    </div>
  );
}
