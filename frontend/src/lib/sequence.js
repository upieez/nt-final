export const MAX_SEQUENCE = 5;

function sameTrack(a, b) {
  return a.artist.trim().toLowerCase() === b.artist.trim().toLowerCase()
    && a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
}

export function addTrack(sequence, track) {
  const clean = { artist: track.artist.trim(), title: track.title.trim() };
  if (!clean.artist || !clean.title) return sequence;
  if (sequence.length >= MAX_SEQUENCE) return sequence;
  if (sequence.some((t) => sameTrack(t, clean))) return sequence;
  return [...sequence, clean];
}

export function removeTrack(sequence, index) {
  return sequence.filter((_, i) => i !== index);
}

export function moveTrack(sequence, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= sequence.length) return sequence;
  const next = [...sequence];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function trackLabel(track) {
  return `${track.artist} - ${track.title}`;
}
