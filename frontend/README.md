# NextTrack frontend

A small React client for the NextTrack API. It has two views:

- **Recommend**: the front panel of a 1990s hi-fi separate. Load up to five seed tracks into the
  slots (press + and type into the LCD, or use MANUAL), set the SIMILARITY, DISCOVERY and STRICTNESS
  faders, press PLAY. The CD tray slides out with the recommended track, its cover, a one-line reason,
  and LISTEN (YouTube), NEXT (load it as the newest seed) and DETAIL (score breakdown, tags, relations,
  alternatives, warnings, diagnostics).
- **Rating study**: a blind comparison. The rater sees three candidate next tracks (NextTrack,
  random and most-popular, shuffled and unlabelled), rates each one, and submits. Ratings are
  anonymous and are appended by the backend as study instrumentation.

## Running

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api and /health to http://localhost:3000
```

Start the backend first (`cd backend && npm start`). The header shows whether the backend is up and
whether it is running in offline (cache only) mode.

```bash
npm test           # Vitest + React Testing Library
npm run lint       # ESLint
npm run build      # production build in dist/
```

## The faders

SIMILARITY is the inverse of the API's `preferences.divergence` (fader at 1.00 sends divergence 0).
Below the midpoint the backend ignores genre strictness and pulls extra candidates from unrelated
genre charts; the STRICTNESS readout then shows `--` and its BYPASS lamp lights. DISCOVERY is
`discoveryFactor` and STRICTNESS is `genreStrictness`. Target genre, excluded artists and the
candidate pool mode are not on the panel and use the API defaults. The rating study has the same
SIMILARITY fader so raters can compare the three systems on a "similar" or a "different" brief.

Album art comes from `GET /api/v1/tracks/info` (Last.fm album images through the backend cache)
and from the `image` field on recommendations, alternatives and study items. A track with no cover
gets a printed disc label with its initials.

## Stateless by design

The client keeps every piece of state in React memory only. There is no localStorage, no cookie,
no session and no analytics. Reloading the page clears the sequence and preferences. Each request
to the API carries everything the API needs, which is the point of the project.

## Layout

```
src/
  App.jsx                 chassis, brand plate, RECOMMEND / STUDY mode keys, hash routing, shared state
  styles.css              the whole front panel: charcoal chassis, LCD, slots, faders, PLAY, tray
  lib/
    api.js                fetch wrapper, ApiError, search, track info and health calls
    sequence.js           pure helpers for add, move, remove (max 5 tracks)
    preferences.js        defaults, clamping, similarity <-> divergence, request builder
    errors.js             HTTP status to plain-language message mapping (shown on the LCD)
    presets.js            six preset seed sequences for the rating study
    study.js              rating state helpers
    useArt.js             album art per track, fetched once and kept in memory
    useHealth.js          backend health for the LCD link readout
    useRecommendation.js  loading, error and result state for the next-track call
  components/
    Lcd                   display strip: ticker, search field, scanning, ERR, link readout
    SeedRack, AlbumArt    five slots with cover art, drag or arrow keys to reorder, EJECT
    SearchDeck            results under the LCD and the MANUAL fallback
    Fader, FaderBank      SIMILARITY, DISCOVERY, STRICTNESS with readouts and the BYPASS lamp
    PlayButton            the illuminated PLAY key
    Tray, DetailPanel     the sliding CD tray and the second display behind DETAIL
    ScoreBreakdown, YouTubePlayer
    StudyView, StudyCard  consent, sequence picker, three trays with rating keypads
```
