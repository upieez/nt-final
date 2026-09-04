# NextTrack frontend

A small React client for the NextTrack API. It has two views:

- **Recommend**: build a listening sequence (search or type artist and title), set preferences,
  ask for the next track, and read the explanation of why it was chosen. The recommended track can
  be played through an embedded YouTube search player and added back into the sequence to continue.
- **Rating study**: a blind comparison. The rater sees three candidate next tracks (NextTrack,
  random and most-popular, shuffled and unlabelled), rates each one, and submits. Ratings are
  anonymous and are appended by the backend to `evaluation/ratings.jsonl` as study instrumentation.

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

## Similar or different

The first control in the preferences panel is a divergence slider (`preferences.divergence`,
0 to 1, default 0). At 0 the most similar candidate wins; at 1 the least similar one does. Past the
visible midpoint (0.5) the backend ignores genre strictness and pulls extra candidates from unrelated
genre charts; the result card then shows a warning saying so, a "Divergence" bar in the breakdown,
and the number of contrast candidates in the diagnostics footer. The rating study has the same
slider so raters can compare the three systems on a "similar" or a "different" brief.

## Stateless by design

The client keeps every piece of state in React memory only. There is no localStorage, no cookie,
no session and no analytics. Reloading the page clears the sequence and preferences. Each request
to the API carries everything the API needs, which is the point of the project.

## Layout

```
src/
  App.jsx                 hash routing between the two views, shared sequence and preference state
  styles.css              all styling, CSS variables, light and dark via prefers-color-scheme
  lib/
    api.js                fetch wrapper, ApiError with status and parsed body
    sequence.js           pure helpers for add, move, remove (max 10 tracks)
    preferences.js        defaults, clamping to [0,1], request builder matching the API contract
    errors.js             HTTP status to plain-language message mapping
    presets.js            six preset seed sequences for the rating study
    study.js              rating state helpers
    useRecommendation.js  loading, error and result state for the next-track call
  components/
    Header, HealthBadge
    SeedBuilder, TrackSearch, ManualAddForm, SequenceList
    PreferencesPanel, Slider, DivergenceSlider
    RecommendPanel, RecommendView, ResultCard, ScoreBreakdown, ErrorMessage
    YouTubePlayer
    StudyView, StudyCard
```

## Playback

The player uses YouTube's keyless search-list embed
(`https://www.youtube.com/embed?listType=search&list=<artist title>`), which shows the top search
results for the artist and title. No API key is needed and no audio is hosted here. The iframe is
only loaded when the user clicks "Load YouTube player".

## Accessibility

All controls are native buttons, inputs and radios with visible labels or `aria-label`s. Focus is
moved to the result heading when a recommendation arrives and to the stage heading as the rating
study progresses. Status text uses live regions. Focus rings use a high-contrast colour, and
`prefers-reduced-motion` disables transitions and smooth scrolling. The layout works down to 400px.
