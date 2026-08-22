#!/usr/bin/env bash
# Curl examples against a running server; BASE defaults to localhost:3000
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
JSON='Content-Type: application/json'

echo "== health"
curl -s "$BASE/health"; echo

echo "== next-track (dynamic pool, defaults)"
curl -s -X POST "$BASE/api/v1/recommendations/next-track" -H "$JSON" -d '{
  "sequence": [{ "artist": "Joy Division", "title": "Disorder" }, { "artist": "The Cure", "title": "A Forest" }],
  "preferences": { "genreStrictness": 0.5, "discoveryFactor": 0.5 },
  "options": { "poolMode": "dynamic", "poolSize": 40, "alternatives": 5 }
}'; echo

echo "== next-track (fixed pool, target genre, excluded artist)"
curl -s -X POST "$BASE/api/v1/recommendations/next-track" -H "$JSON" -d '{
  "sequence": [{ "artist": "Joy Division", "title": "Disorder" }],
  "preferences": { "genreStrictness": 0.9, "discoveryFactor": 0.2, "targetGenre": "post-punk", "excludeArtists": ["The Cure"] },
  "options": { "poolMode": "fixed", "poolSize": 80 }
}'; echo

echo "== baseline (popular)"
curl -s -X POST "$BASE/api/v1/recommendations/baseline" -H "$JSON" -d '{
  "sequence": [{ "artist": "Joy Division", "title": "Disorder" }, { "artist": "The Cure", "title": "A Forest" }],
  "strategy": "popular"
}'; echo

echo "== track search"
curl -s "$BASE/api/v1/tracks/search?q=forest"; echo

echo "== study compare"
curl -s -X POST "$BASE/api/v1/study/compare" -H "$JSON" -d '{
  "sequence": [{ "artist": "Joy Division", "title": "Disorder" }, { "artist": "The Cure", "title": "A Forest" }],
  "preferences": { "genreStrictness": 0.5, "discoveryFactor": 0.5 }
}'; echo

echo "== validation error (empty sequence)"
curl -s -X POST "$BASE/api/v1/recommendations/next-track" -H "$JSON" -d '{ "sequence": [] }'; echo
