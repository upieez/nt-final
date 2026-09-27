# NextTrack

A stateless music recommendation API. Send a short sequence of recently played
tracks plus a few preference parameters and it returns the track that best follows,
with an explanation of why. No accounts, no stored history.

CM3070 Final Project, University of London (Goldsmiths). Template: CM3035 Advanced
Web Design, Project Idea 2 (7.2), NextTrack: A music recommendation API.

## How it works

1. Seeds are reconciled across Last.fm (autocorrected names, tags, listeners), MusicBrainz
   (recording and artist ids, ISRCs, genres, country) and Wikidata (genres, labels, members).
   The MusicBrainz recording id is the canonical id once resolved; ISRCs cross-check weak name matches.
2. A candidate pool is gathered per request from Last.fm `track.getSimilar` for each seed plus
   `artist.getSimilar` -> `artist.getTopTracks`, de-duplicated, seeds and excluded artists removed,
   capped at `poolSize` (default 40, max 80). A bundled 46-track pool is the `fixed` fallback.
3. Each candidate is scored on tag overlap, genre overlap and a graph signal (shared label, country,
   member or collaboration links), recency-weighted toward the most recent seed, then the discovery
   penalty and genre strictness are applied.
4. Every upstream call goes through one cached HTTP layer with per-source rate limits, so repeated
   requests are served from `backend/data/cache/snapshot.json` and the whole API can run offline.

## Backend

```bash
cd backend
npm install
cp .env.example .env   # add your Last.fm API key
npm test               # offline unit and integration tests (jest, supertest, nock fixtures)
npm start              # http://localhost:3000
```

Warm the cache once with live data so the API and the evaluation harness can run offline afterwards:

```bash
cd backend
npm run prime-cache    # reads evaluation/seed-sequences.json if present, else the report cases
git add data/cache/snapshot.json
```

Then run without any network access:

```bash
NEXTTRACK_OFFLINE=1 npm start
```

In offline mode nothing is fetched: a cache miss is reported in `warnings` as "not in the offline
cache" and stale entries are still served. `npm run smoke` prints curl examples against a running server.

### Environment variables

| Variable                     | Default                            | Purpose                                      |
| ---------------------------- | ---------------------------------- | -------------------------------------------- |
| `LASTFM_API_KEY`             | required unless offline            | Last.fm API key                              |
| `PORT`                       | 3000                               | listen port                                  |
| `NEXTTRACK_OFFLINE`          | 0                                  | `1` serves only from the cache snapshot      |
| `NEXTTRACK_CACHE_FILE`       | `backend/data/cache/snapshot.json` | cache snapshot location                      |
| `NEXTTRACK_CACHE_TTL_DAYS`   | 30                                 | days before a cached response is refetched   |
| `NEXTTRACK_ENRICH_BUDGET_MS` | 25000                              | MusicBrainz/Wikidata time budget per request |
| `STUDY_SECRET`               | dev default                        | HMAC key for blind study trial ids           |
| `CORS_ORIGIN`                | any                                | allowed browser origin                       |

Rate limits: MusicBrainz 1 request/s with `User-Agent: NextTrack/1.0 (samuelhww@gmail.com)`,
Wikidata 2/s, Last.fm 5/s. Upstream timeout 5 s.

## Endpoints

### `POST /api/v1/recommendations/next-track`

```bash
curl -X POST http://localhost:3000/api/v1/recommendations/next-track \
  -H 'Content-Type: application/json' \
  -d '{"sequence":[{"artist":"Joy Division","title":"Disorder"},{"artist":"The Cure","title":"A Forest"}],
       "preferences":{"genreStrictness":0.5,"discoveryFactor":0.5,"divergence":0,"targetGenre":"post-punk","excludeArtists":["The Cure"]},
       "options":{"poolMode":"dynamic","poolSize":40,"alternatives":5}}'
```

Rules: `sequence` has 1 to 10 items with non-empty `artist` and `title` strings of at most 200
characters (an optional `isrc` is used when present); preference numbers are clamped to [0, 1],
`genreStrictness` and `discoveryFactor` default to 0.5 and `divergence` to 0 (0 = as similar as
possible, 1 = something completely different: the score is flipped, unrelated tag charts join the pool
and strictness is ignored); `targetGenre` is an optional string and `excludeArtists` an optional string array;
`options.poolMode` is `dynamic` (default) or `fixed`.

Response fields: `recommendation` (artist, title, mbid, wikidataId, listeners, tags), `score`,
`breakdown` (tagOverlap, genreOverlap, graphSignal, popularityPenalty, recencyWeightApplied, divergence, divergenceApplied),
`explanation` (matchedTags, matchedGenres, sharedRelations, summary), `alternatives`,
`candidatePool` (mode, size, scored, scoreless, excluded, contrast), `seeds` (resolved, mbid, tagSource),
`diagnostics` (latencyMs, cacheHits, cacheMisses, upstreamCalls, matchRate, enrichmentSkipped)
and `warnings`.

Errors: `400 { error, details[] }` for invalid input, `422 { error, warnings }` when no seed or no
candidate can be used, `502 { error, source }` on an upstream failure and `504 { error, source }`
on an upstream timeout.

### Other endpoints

- `GET /health` -> `{ status: "ok", offline: bool }`
- `GET /api/v1/tracks/search?q=` -> `{ results: [{ artist, title, listeners }] }` (Last.fm track.search, max 8)
- `GET /api/v1/tracks/info?artist=&title=` -> `{ artist, title, found, image, album, listeners }` (Last.fm track.getInfo
  via the shared cache; `image` is the largest album cover URL or null, and the frontend uses it for seed slot art)
- `GET /api/v1/tracks/video?artist=&title=` -> `{ videoId, searchUrl }` (top hit on the YouTube results page, kept in
  memory only; `videoId` is null when nothing was found and the frontend then offers the search link instead)
- `POST /api/v1/recommendations/baseline` body `{ sequence, strategy: "random" | "popular", options }` ->
  the next-track response shape without `breakdown`, with `strategy` set, over the same candidate pool
- `POST /api/v1/study/compare` body `{ sequence, preferences }` -> `{ trialId, items: [{ slot, artist, title, image }] }`,
  the NextTrack, random and popular picks in a shuffled order; the slot-to-system mapping lives only
  inside the HMAC-signed `trialId`, the server keeps no trial state

## Evaluation

`evaluation/` holds the offline harness, the survey and rating analysers and their jest tests
(run by `npm test` in `backend/`). Everything runs in-process against the backend modules, never
over HTTP, and the harness runs with `NEXTTRACK_OFFLINE=1`, so it needs the primed cache snapshot.

```bash
cd backend
npm run prime-cache                                   # once, live, with LASTFM_API_KEY set
npm run harness                                       # offline, writes evaluation/results/
npm run analyse:survey -- ~/Downloads/survey.csv      # Google Forms export -> results/survey.md
npm run analyse:ratings                               # evaluation/ratings.jsonl -> results/ratings.md
```

The harness runs the 40 sequences in `evaluation/seed-sequences.json` (20 genre-coherent,
10 mixed, 10 with a sparsely tagged track) through NextTrack with default preferences, a seeded
random baseline (mean over 20 draws) and the most-popular baseline, all over the same candidate
pool, then reruns NextTrack with `discoveryFactor`, `genreStrictness` and `divergence` at 0 and 1.
Per sequence it records tag coherence (cosine between the winner's and the most recent seed's
Last.fm tag vectors), genre continuation (the winner shares a tag or MusicBrainz/Wikidata genre
with the most recent seed, with a genre-only variant), the winner's popularity percentile within
the pool, whether each parameter changed the winner, cache-warm latency, the reconciliation match
rate, seed resolution and pool sizes. `results/results.md` states the Chapter 3 success criteria
with pass or fail, `results/results.json` holds every number and the four SVG charts sit beside
them. Sequences that fail are listed with their status code and excluded from the averages.

`analyse-survey.js` matches the sixteen survey questions to CSV columns by keyword, so header
edits in the form do not break it, and reports counts, Likert means and the three motivation
checks (shared-account confusion, self-censoring, comfort with stored history). `analyse-ratings.js`
reads the anonymous study lines, reports per-system means, per-trial preferences and a paired sign
test of NextTrack against each baseline.

## Layout

```
backend/
  app.js                 express app (routes, error mapping)
  server.js              entry point with graceful shutdown
  lib/http.js            cached, rate-limited HTTP layer, offline mode, per-request counters
  lib/lastfm.js          Last.fm client
  lib/musicbrainz.js     MusicBrainz client
  lib/wikidata.js        Wikidata SPARQL client
  lib/reconcile.js       name normalisation and cross-source track/artist resolution
  lib/candidates.js      dynamic and fixed candidate pools
  lib/scoring.js         signals, weights, penalties, filters
  lib/recommend.js       the next-track pipeline
  lib/baseline.js        random and most-popular baselines
  lib/study.js           blind study trials and ratings
  data/candidates.json   fixed pool
  data/cache/            committed cache snapshot
  scripts/               prime-cache.js, smoke.sh
  test/                  jest suites and hand-written fixtures
evaluation/
  seed-sequences.json    40 harness sequences, shared with prime-cache
  run-harness.js         offline harness -> results/
  analyse-survey.js      survey CSV -> results/survey.md
  analyse-ratings.js     ratings.jsonl -> results/ratings.md
  lib/                   metrics, svg writer, csv reader, report writers
  test/                  jest suites and synthetic fixtures
```

## Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173, proxies /api to the backend on port 3000
```

A React client with a seed builder, preference sliders, an explanation view for each
recommendation, a YouTube embed of the chosen track, and a blind rating study that compares
NextTrack against random and most-popular baselines. All client state is in memory only, so there
is nothing to clear and nothing that follows you between visits. See `frontend/README.md`.
