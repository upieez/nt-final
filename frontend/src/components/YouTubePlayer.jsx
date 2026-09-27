import { useEffect, useState } from 'react';
import { getVideo } from '../lib/api.js';

export function youtubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
}

export function youtubeSearchUrl(track) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${track.artist} ${track.title}`)}`;
}

// Loads only on request
export default function YouTubePlayer({ track, loaded, onLoad, compact }) {
  const [own, setOwn] = useState(false);
  const [video, setVideo] = useState({ state: 'idle', videoId: null });
  const isLoaded = loaded ?? own;
  const load = onLoad ?? (() => setOwn(true));
  const key = `${track.artist}|${track.title}`;

  useEffect(() => {
    if (!isLoaded) return undefined;
    const controller = new AbortController();
    setVideo({ state: 'loading', videoId: null });
    getVideo(track, controller.signal)
      .then((body) => setVideo({ state: body.videoId ? 'ready' : 'missing', videoId: body.videoId || null }))
      .catch(() => { if (!controller.signal.aborted) setVideo({ state: 'missing', videoId: null }); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, key]);

  const title = `YouTube player for ${track.artist} ${track.title}`;
  return (
    <div className={`player${compact ? ' player-compact' : ''}`}>
      {!isLoaded && (
        <button type="button" className="key key-small" onClick={load}>Load YouTube player</button>
      )}
      {isLoaded && video.state === 'loading' && (
        <div className="player-frame player-note" role="status">Finding the video...</div>
      )}
      {isLoaded && video.state === 'ready' && (
        <div className="player-frame">
          <iframe src={youtubeEmbedUrl(video.videoId)} title={title}
            allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
        </div>
      )}
      {isLoaded && video.state === 'missing' && (
        <div className="player-frame player-note">
          <span>No embeddable video found.</span>
          <a className="key key-small" href={youtubeSearchUrl(track)} target="_blank" rel="noreferrer">Open on YouTube</a>
        </div>
      )}
    </div>
  );
}
