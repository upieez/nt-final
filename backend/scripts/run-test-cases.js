// Runs the report test cases against a running server and writes test-results.md
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { getTrackInfo } = require('../lib/lastfm');

const BASE = process.env.TEST_TARGET || 'http://localhost:3000';
const ENDPOINT = `${BASE}/api/v1/recommendations/next-track`;
const CANDIDATES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'candidates.json'), 'utf8')
);

// Three functional cases plus a parameter toggle case
const CASES = [
  {
    name: 'Case 1 - Genre-coherent (post-punk / gothic)',
    sequence: [
      { artist: 'Joy Division', title: 'Disorder' },
      { artist: 'Siouxsie and the Banshees', title: 'Cities in Dust' },
      { artist: 'The Cure', title: 'A Forest' }
    ],
    preferences: { genreStrictness: 0.5, discoveryFactor: 0.5 }
  },
  {
    name: 'Case 2 - Genre-mixed (hip-hop + ambient + metal)',
    sequence: [
      { artist: 'Nas', title: 'N.Y. State of Mind' },
      { artist: 'Brian Eno', title: 'An Ending (Ascent)' },
      { artist: 'Metallica', title: 'Master of Puppets' }
    ],
    preferences: { genreStrictness: 0.5, discoveryFactor: 0.5 }
  },
  {
    name: 'Case 3 - Sparse-metadata (obscure / recent independent seed)',
    sequence: [
      { artist: 'Nick Drake', title: 'Pink Moon' },
      { artist: 'Greg Mendez', title: 'Hoping You Pull Through' },
      { artist: 'Tomberlin', title: 'Happy Accident' }
    ],
    preferences: { genreStrictness: 0.5, discoveryFactor: 0.5 }
  },
  {
    name: 'Case 4 - Parameter toggle on the coherent seed (discovery 0.0 vs 0.9, strictness 0.0 vs 0.9)',
    sequence: [
      { artist: 'Joy Division', title: 'Disorder' },
      { artist: 'The Cure', title: 'A Forest' }
    ],
    preferences: { genreStrictness: 0.5, discoveryFactor: 0.5 },
    toggles: [
      { label: 'discovery=0.0, strictness=0.0', preferences: { genreStrictness: 0.0, discoveryFactor: 0.0 } },
      { label: 'discovery=0.9, strictness=0.0', preferences: { genreStrictness: 0.0, discoveryFactor: 0.9 } },
      { label: 'discovery=0.0, strictness=0.9', preferences: { genreStrictness: 0.9, discoveryFactor: 0.0 } }
    ]
  }
];

function poolMinusSeeds(sequence) {
  const seedKeys = new Set(
    sequence.map((s) => `${s.artist.toLowerCase()}|${s.title.toLowerCase()}`)
  );
  return CANDIDATES.filter(
    (c) => !seedKeys.has(`${c.artist.toLowerCase()}|${c.title.toLowerCase()}`)
  );
}

function randomPick(sequence) {
  const pool = poolMinusSeeds(sequence);
  return pool[Math.floor(Math.random() * pool.length)];
}

async function mostPopularPick(sequence) {
  const pool = poolMinusSeeds(sequence);
  let best = null;
  let bestListeners = -1;
  for (const c of pool) {
    const info = await getTrackInfo(c.artist, c.title);
    const listeners = info.status === 'ok' ? info.listeners : 0;
    if (listeners > bestListeners) {
      bestListeners = listeners;
      best = { ...c, listeners };
    }
  }
  return best;
}

async function postCase(sequence, preferences) {
  try {
    const res = await axios.post(ENDPOINT, { sequence, preferences }, { timeout: 120000 });
    return { ok: true, status: res.status, body: res.data };
  } catch (err) {
    if (err.response) {
      return { ok: false, status: err.response.status, body: err.response.data };
    }
    return { ok: false, status: 'no-response', body: { error: err.message } };
  }
}

function fmtTrack(t) {
  return t ? `${t.artist} - ${t.title}` : '(none)';
}

function fmtResponse(result) {
  const lines = [];
  lines.push(`- HTTP status: \`${result.status}\``);
  const b = result.body || {};
  if (b.recommendation) {
    lines.push(`- Recommendation: **${fmtTrack(b.recommendation)}**`);
    lines.push(`- score (adjusted): \`${b.score}\`  |  rawScore: \`${b.rawScore}\``);
    lines.push(`- matchedTags: ${b.matchedTags && b.matchedTags.length ? b.matchedTags.map((t) => `\`${t}\``).join(', ') : '(none)'}`);
    lines.push(`- recencyWeightApplied: \`${b.recencyWeightApplied}\``);
    lines.push(`- candidatesConsidered: \`${b.candidatesConsidered}\`  |  candidatesScoreless: \`${b.candidatesScoreless}\`  |  candidatesExcluded: \`${b.candidatesExcluded}\``);
        if (b.winnerTagSource !== undefined) {
      lines.push(`- winnerTagSource: \`${b.winnerTagSource}\`  |  seedsUsingArtistTags: \`${b.seedsUsingArtistTags}\`  |  candidatesUsingArtistTags: \`${b.candidatesUsingArtistTags}\``);
    }
  } else if (b.error) {
    lines.push(`- error: ${b.error}`);
    if (b.candidatesScoreless !== undefined) {
      lines.push(`- candidatesConsidered: \`${b.candidatesConsidered}\`  |  candidatesScoreless: \`${b.candidatesScoreless}\`  |  candidatesExcluded: \`${b.candidatesExcluded}\``);
    }
  }
  if (b.warnings && b.warnings.length) {
    lines.push(`- warnings:`);
    for (const w of b.warnings) lines.push(`    - ${w.track}: ${w.issue}`);
  }
  return lines.join('\n');
}

async function main() {
    try {
    await axios.get(`${BASE}/health`, { timeout: 5000 });
  } catch (err) {
    console.error(`Cannot reach server at ${BASE}. Start it with "node server.js" first.`);
    process.exit(1);
  }

  const out = [];
  out.push('# NextTrack Feature Prototype - Test Results');
  out.push('');
  out.push(`Generated: ${new Date().toISOString()}`);
  out.push(`Endpoint: \`${ENDPOINT}\``);
  out.push(`Candidate pool size: ${CANDIDATES.length}`);
  out.push('');
  out.push('Each case records the live endpoint output, plus a random-selection and a');
  out.push('most-popular-selection baseline over the same pool. The "plausible continuation?"');
  out.push('line is left for manual judgement - fill it in by hand per the brief.');
  out.push('');
  out.push('---');
  out.push('');

  for (const testCase of CASES) {
    console.log(`Running: ${testCase.name}`);
    out.push(`## ${testCase.name}`);
    out.push('');
    out.push('**Seed sequence (least -> most recent):**');
    for (const s of testCase.sequence) out.push(`- ${fmtTrack(s)}`);
    out.push('');

        out.push(`**Default preferences:** \`${JSON.stringify(testCase.preferences)}\``);
    out.push('');
    const primary = await postCase(testCase.sequence, testCase.preferences);
    out.push('**Metadata-scored result:**');
    out.push('');
    out.push(fmtResponse(primary));
    out.push('');

        console.log('  computing baselines...');
    const rnd = randomPick(testCase.sequence);
    const pop = await mostPopularPick(testCase.sequence);
    out.push('**Baselines (same pool):**');
    out.push(`- Random pick: ${fmtTrack(rnd)}`);
    out.push(`- Most-popular pick: ${fmtTrack(pop)}${pop && pop.listeners ? ` (\`${pop.listeners}\` listeners)` : ''}`);
    out.push('');
    out.push('_Plausible continuation vs baselines? (Y/N + note) ->_ ');
    out.push('');

        if (testCase.toggles) {
      out.push('**Parameter toggles (does the winner actually change?):**');
      out.push('');
      for (const toggle of testCase.toggles) {
        console.log(`  toggle: ${toggle.label}`);
        const r = await postCase(testCase.sequence, toggle.preferences);
        const rec = r.body && r.body.recommendation ? fmtTrack(r.body.recommendation) : `(${r.body && r.body.error ? 'error/422' : 'no rec'})`;
        const score = r.body && r.body.score !== undefined ? ` - score \`${r.body.score}\`` : '';
        out.push(`- \`${toggle.label}\` -> **${rec}**${score}`);
      }
      out.push('');
    }

    out.push('---');
    out.push('');
  }

  const outPath = path.join(__dirname, '..', 'test-results.md');
  fs.writeFileSync(outPath, out.join('\n'), 'utf8');
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
