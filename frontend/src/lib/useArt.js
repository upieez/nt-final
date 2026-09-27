import { useEffect, useState } from 'react';
import { getTrackInfo } from './api.js';

// Per-tab album art cache
const cache = new Map();

export function artKey(track) {
  return `${track.artist.trim().toLowerCase()}|${track.title.trim().toLowerCase()}`;
}

export function primeArt(track, image) {
  if (track && image) cache.set(artKey(track), image);
}

export default function useArt(track) {
  const key = track ? artKey(track) : null;
  const known = track?.image || (key ? cache.get(key) : null) || null;
  const [image, setImage] = useState(known);

  useEffect(() => {
    if (!track) return undefined;
    if (known) {
      setImage(known);
      return undefined;
    }
    if (cache.has(key)) {
      setImage(cache.get(key));
      return undefined;
    }
    const controller = new AbortController();
    getTrackInfo(track, controller.signal)
      .then((info) => {
        cache.set(key, info.image || null);
        setImage(info.image || null);
      })
      .catch(() => {
        if (!controller.signal.aborted) cache.set(key, null);
      });
    return () => controller.abort();
  }, [key, known, track]);

  return image;
}
