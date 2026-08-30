export const SLOTS = ['A', 'B', 'C'];
export const SCALE = [1, 2, 3, 4, 5];

export function emptyRatings(items) {
  const ratings = {};
  items.forEach((item) => {
    ratings[item.slot] = { coherence: null, novelty: null, wouldPlay: null };
  });
  return ratings;
}

export function ratingComplete(r) {
  return Boolean(r) && SCALE.includes(r.coherence) && SCALE.includes(r.novelty) && typeof r.wouldPlay === 'boolean';
}

export function allRatingsComplete(ratings) {
  return SLOTS.every((slot) => ratingComplete(ratings[slot]));
}
