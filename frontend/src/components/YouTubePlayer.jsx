import { useState } from 'react';

export function youtubeSearchEmbedUrl(track) {
  const query = encodeURIComponent(`${track.artist} ${track.title}`);
  return `https://www.youtube.com/embed?listType=search&list=${query}`;
}

export default function YouTubePlayer({ track, compact }) {
  const [loaded, setLoaded] = useState(false);
  const title = `YouTube search results for ${track.artist} ${track.title}`;
  return (
    <div className={`player${compact ? ' player-compact' : ''}`}>
      {!loaded && (
        <button type="button" className="btn btn-small" onClick={() => setLoaded(true)}>
          Load YouTube player
        </button>
      )}
      {loaded && (
        <div className="player-frame">
          <iframe
            src={youtubeSearchEmbedUrl(track)}
            title={title}
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      )}
      <p className="small muted player-note">
        Playback happens in the YouTube player, which shows the top search results for the artist and
        title. NextTrack does not host audio and does not know which video you pick.
      </p>
    </div>
  );
}
