import { useState } from "react";
import useArt from "../lib/useArt.js";

function hue(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1)
    h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

function initials(track) {
  const words = `${track.artist} ${track.title}`.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function AlbumArt({
  track,
  size = "small",
  decorative = false,
}) {
  const image = useArt(track);
  const [failed, setFailed] = useState(null);
  const alt = decorative
    ? ""
    : `Album art for ${track.title} by ${track.artist}`;
  if (image && failed !== image) {
    return (
      <img
        className={`art art-${size}`}
        src={image}
        alt={alt}
        loading="lazy"
        draggable="false"
        onError={() => setFailed(image)}
      />
    );
  }
  return (
    <div
      className={`art art-${size} art-disc`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : alt}
      style={{ "--disc-hue": hue(track.artist + track.title) }}
    >
      <span className="art-disc-label">{initials(track)}</span>
    </div>
  );
}
