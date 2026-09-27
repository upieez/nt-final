export default function PlayButton({ disabled, loading, onClick, hint }) {
  return (
    <div className="play-block">
      <button type="button" className={`play${loading ? ' play-busy' : ''}`} disabled={disabled || loading} onClick={onClick}
        aria-label={loading ? 'Finding the next track' : 'Play: find the next track'}>
        <span className="play-face" aria-hidden="true">
          <span className="play-glyph">&#9654;</span>
          <span className="play-word">Play</span>
        </span>
      </button>
      <span className="silk silk-dim play-hint" aria-live="polite">{hint}</span>
    </div>
  );
}
