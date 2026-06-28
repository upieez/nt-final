# NextTrack Feature Prototype - Test Results

Generated: 2026-06-28T11:55:50.856Z
Endpoint: `http://localhost:3000/api/v1/recommendations/next-track`
Candidate pool size: 46

Each case records the live endpoint output, plus a random-selection and a
most-popular-selection baseline over the same pool. The "plausible continuation?"
line is left for manual judgement - fill it in by hand per the brief.

---

## Case 1 - Genre-coherent (post-punk / gothic)

**Seed sequence (least -> most recent):**
- Joy Division - Disorder
- Siouxsie and the Banshees - Cities in Dust
- The Cure - A Forest

**Default preferences:** `{"genreStrictness":0.5,"discoveryFactor":0.5}`

**Metadata-scored result:**

- HTTP status: `200`
- Recommendation: **Siouxsie and the Banshees - Spellbound**
- score (adjusted): `0.1906`  |  rawScore: `0.3531`
- matchedTags: `post-punk`, `new wave`, `80s`, `gothic`, `gothic rock`, `goth`, `female vocalists`, `alternative`, `rock`
- recencyWeightApplied: `true`
- candidatesConsidered: `46`  |  candidatesScoreless: `27`  |  candidatesExcluded: `1`
- warnings:
    - Joy Division - Disorder: no tags returned by Last.fm

**Baselines (same pool):**
- Random pick: Mavi - Doves
- Most-popular pick: Carly Rae Jepsen - Call Me Maybe (`2380904` listeners)

_Plausible continuation vs baselines? (Y/N + note) ->_ 

---

## Case 2 - Genre-mixed (hip-hop + ambient + metal)

**Seed sequence (least -> most recent):**
- Nas - N.Y. State of Mind
- Brian Eno - An Ending (Ascent)
- Metallica - Master of Puppets

**Default preferences:** `{"genreStrictness":0.5,"discoveryFactor":0.5}`

**Metadata-scored result:**

- HTTP status: `200`
- Recommendation: **Slayer - Raining Blood**
- score (adjusted): `0.1361`  |  rawScore: `0.2583`
- matchedTags: `thrash metal`, `metal`, `heavy metal`, `thrash`, `speed metal`, `80s`
- recencyWeightApplied: `true`
- candidatesConsidered: `43`  |  candidatesScoreless: `26`  |  candidatesExcluded: `1`
- warnings:
    - Brian Eno - An Ending (Ascent): no tags returned by Last.fm

**Baselines (same pool):**
- Random pick: Dua Lipa - Don't Start Now
- Most-popular pick: Carly Rae Jepsen - Call Me Maybe (`2380904` listeners)

_Plausible continuation vs baselines? (Y/N + note) ->_ 

---

## Case 3 - Sparse-metadata (obscure / recent independent seed)

**Seed sequence (least -> most recent):**
- Nick Drake - Pink Moon
- Greg Mendez - Hoping You Pull Through
- Tomberlin - Happy Accident

**Default preferences:** `{"genreStrictness":0.5,"discoveryFactor":0.5}`

**Metadata-scored result:**

- HTTP status: `200`
- Recommendation: **Bon Iver - Skinny Love**
- score (adjusted): `0.0939`  |  rawScore: `0.1841`
- matchedTags: `folk`, `indie`, `acoustic`, `singer-songwriter`, `beautiful`, `mellow`
- recencyWeightApplied: `false`
- candidatesConsidered: `45`  |  candidatesScoreless: `27`  |  candidatesExcluded: `1`
- warnings:
    - Greg Mendez - Hoping You Pull Through: artist/track not found on Last.fm
    - Tomberlin - Happy Accident: no tags returned by Last.fm

**Baselines (same pool):**
- Random pick: Bauhaus - Bela Lugosi's Dead
- Most-popular pick: Carly Rae Jepsen - Call Me Maybe (`2380904` listeners)

_Plausible continuation vs baselines? (Y/N + note) ->_ 

---

## Case 4 - Parameter toggle on the coherent seed (discovery 0.0 vs 0.9, strictness 0.0 vs 0.9)

**Seed sequence (least -> most recent):**
- Joy Division - Disorder
- The Cure - A Forest

**Default preferences:** `{"genreStrictness":0.5,"discoveryFactor":0.5}`

**Metadata-scored result:**

- HTTP status: `200`
- Recommendation: **Siouxsie and the Banshees - Spellbound**
- score (adjusted): `0.118`  |  rawScore: `0.2185`
- matchedTags: `post-punk`, `new wave`, `80s`, `gothic`, `gothic rock`, `alternative`, `rock`
- recencyWeightApplied: `false`
- candidatesConsidered: `46`  |  candidatesScoreless: `27`  |  candidatesExcluded: `1`
- warnings:
    - Joy Division - Disorder: no tags returned by Last.fm

**Baselines (same pool):**
- Random pick: Mastodon - Blood and Thunder
- Most-popular pick: Carly Rae Jepsen - Call Me Maybe (`2380904` listeners)

_Plausible continuation vs baselines? (Y/N + note) ->_ 

**Parameter toggles (does the winner actually change?):**

- `discovery=0.0, strictness=0.0` -> **Echo & the Bunnymen - The Killing Moon** - score `0.2196`
- `discovery=0.9, strictness=0.0` -> **Siouxsie and the Banshees - Spellbound** - score `0.0375`
- `discovery=0.0, strictness=0.9` -> **Echo & the Bunnymen - The Killing Moon** - score `0.2196`

---
