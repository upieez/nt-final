# Scoring

All weights live at the top of `backend/lib/scoring.js`. This page documents what they mean.

## Inputs

For a request with seeds `s_1 .. s_n` (least recent first) and a candidate `c`:

- `tags(x)`: Last.fm top tags for track `x`, weights scaled to sum to 1. When a track has no tags the
  artist's tags are used at confidence `ARTIST_TAG_CONFIDENCE = 0.6`.
- `genres(x)`: union of MusicBrainz recording genres, MusicBrainz artist genres and Wikidata `P136`
  genres for the artist of `x`, compared after name normalisation.
- `artist(x)`: the artist entity `{ mbid, name, country, labels[], members[], memberOf[] }` built from
  MusicBrainz (`inc=genres+tags+url-rels`) and Wikidata (`P264` labels, `P495` country, `P527` members,
  `P463` member of).

## Recency weighting

Seed `s_i` has weight `r_i = RECENCY_BASE^(n - i)` with `RECENCY_BASE = 0.6`, so the most recent seed
has weight 1, the one before it 0.6, then 0.36. `recencyWeightApplied` in the response is true when
more than one seed contributed.

## Signals, each in [0, 1]

1. Tag overlap: cosine similarity between the candidate tag vector and the sequence tag vector
   `T = sum_i r_i * confidence_i * tags(s_i)`.

   `tagOverlap = (tags(c) . T) / (|tags(c)| |T|) * confidence_c`

2. Genre overlap: share of the recency-weighted genre mass that the candidate covers. Each seed's
   genres share its recency weight equally: `G[g] = sum_i r_i / |genres(s_i)|` for `g` in `genres(s_i)`.

   `genreOverlap = sum_{g in genres(c)} G[g] / sum_g G[g]`

3. Graph signal: relations between `artist(c)` and each `artist(s_i)`, one of each type per pair:

   | relation | condition | weight |
   |---|---|---|
   | member | shared member, candidate is a member of the seed band (or vice versa), or both belong to the same group | 0.5 |
   | label | a record label in common | 0.4 |
   | artist | same artist as the seed (replaces the other types for that pair) | 0.3 |
   | country | same country code | 0.1 |

   `strength_i = min(1, sum of weights for the pair)` and
   `graphSignal = sum_i r_i * strength_i / sum_i r_i`.

## Combination

`raw = W_TAG * tagOverlap + W_GENRE * genreOverlap + W_GRAPH * graphSignal`
with `W_TAG = 0.5`, `W_GENRE = 0.3`, `W_GRAPH = 0.2` (sum 1, so `raw` is in [0, 1]).

Tags carry the most weight because they are track-specific; genres and graph relations are
artist-level and describe a whole catalogue.

## Preferences

- `divergence` (v, default 0): applied first, `raw' = (1 - v) * raw + v * (1 - raw)`. At v = 0 the
  score is untouched; at v = 1 the least similar candidate ranks first; at v = 0.5 every candidate
  scores 0.5 before the popularity penalty, so popularity alone decides. `breakdown.divergence` echoes
  the value and `breakdown.divergenceApplied` is true when v > 0.
- `discoveryFactor` (d): `popularity = log(listeners + 1) / log(maxListeners + 1)` over the eligible
  pool, `popularityPenalty = raw' * d * popularity`, `score = raw' - popularityPenalty`.
  At d = 1 the most popular candidate scores 0; at d = 0 popularity is ignored.
- `genreStrictness` (g): a candidate "overlaps the most recent seed" when it shares at least one tag
  or genre with `s_n`. At `g >= STRICTNESS_THRESHOLD (0.7)` candidates without that overlap are
  excluded. Below the threshold they are kept but damped: `score *= 1 - g * SOFT_STRICTNESS (0.5)`.
- `targetGenre`: hard filter, the candidate must carry the genre as a Last.fm tag or a
  MusicBrainz/Wikidata genre (normalised comparison, so "post punk" matches "post-punk").
- `excludeArtists`: removed while building the pool and counted in `candidatePool.excluded`.

## Ranking and ties

Candidates are sorted by `score` descending; ties go to the candidate with fewer listeners.
`alternatives` are the next `options.alternatives` entries (default 5, max 10).

## Candidate pool accounting

`candidatePool = { mode, size, scored, scoreless, excluded }` where `size` is the pool after
de-duplication and seed removal, `scored` candidates had tags or genres and passed the filters,
`scoreless` had neither tags nor genres, and `excluded` counts excluded artists, lookup failures and
candidates dropped by the strictness or target-genre filters.
