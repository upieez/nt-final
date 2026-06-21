# NextTrack

A stateless music recommendation API. Send a short sequence of recently played
tracks plus a few preference parameters and it returns the track that best follows,
with an explanation of why. No accounts, no stored history.

CM3070 Final Project, University of London (Goldsmiths). Template: CM3035 Advanced
Web Design, Project Idea 2 (7.2), NextTrack: A music recommendation API.

## Backend

```bash
cd backend
npm install
cp .env.example .env   # add your Last.fm API key
npm start              # http://localhost:3000
```

```bash
curl -X POST http://localhost:3000/api/v1/recommendations/next-track \
  -H 'Content-Type: application/json' \
  -d '{"sequence":[{"artist":"Joy Division","title":"Disorder"},{"artist":"The Cure","title":"A Forest"}],
       "preferences":{"genreStrictness":0.5,"discoveryFactor":0.5}}'
```
