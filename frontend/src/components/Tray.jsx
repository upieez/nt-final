import { useEffect, useRef, useState } from "react";
import AlbumArt from "./AlbumArt.jsx";
import DetailPanel from "./DetailPanel.jsx";
import YouTubePlayer from "./YouTubePlayer.jsx";

// CD tray for the result
export default function Tray({ result, onUseAsSeed }) {
  const [listening, setListening] = useState(false);
  const [detail, setDetail] = useState(false);
  const headingRef = useRef(null);
  const open = Boolean(result);

  useEffect(() => {
    setListening(false);
    setDetail(false);
    if (result && headingRef.current) headingRef.current.focus();
  }, [result]);

  const rec = result?.recommendation;
  return (
    <section
      className={`tray-bay${open ? " tray-bay-open" : ""}`}
      aria-label="Result tray"
      aria-live="polite"
    >
      <div className="tray-lip" aria-hidden="true">
        <span className="silk silk-dim">Disc</span>
      </div>
      <div className="tray">
        {rec && (
          <div className="tray-inner">
            <div className="tray-art">
              {listening ? (
                <YouTubePlayer track={rec} loaded onLoad={() => {}} />
              ) : (
                <AlbumArt track={rec} size="large" />
              )}
            </div>
            <div className="tray-text">
              <span className="silk silk-dim">Play next</span>
              <h2 className="tray-title" ref={headingRef} tabIndex={-1}>
                {rec.title}
              </h2>
              <p className="tray-artist">{rec.artist}</p>
              {result.explanation?.summary && (
                <p className="tray-why">{result.explanation.summary}</p>
              )}
              <div className="tray-keys">
                <button
                  type="button"
                  className={`key${listening ? " key-on" : ""}`}
                  aria-pressed={listening}
                  onClick={() => setListening((l) => !l)}
                >
                  Listen
                </button>
                <button
                  type="button"
                  className="key key-amber"
                  onClick={() => onUseAsSeed(rec)}
                >
                  Next
                </button>
                <button
                  type="button"
                  className={`key${detail ? " key-on" : ""}`}
                  aria-pressed={detail}
                  aria-expanded={detail}
                  onClick={() => setDetail((d) => !d)}
                >
                  Detail
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {rec && detail && (
        <DetailPanel result={result} onUseAsSeed={onUseAsSeed} />
      )}
    </section>
  );
}
