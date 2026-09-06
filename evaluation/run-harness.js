// Offline evaluation harness: 40 seed sequences through NextTrack, random and most-popular from the cache snapshot
const fs = require('fs');
const path = require('path');

process.env.NEXTTRACK_OFFLINE = '1';

const http = require('../backend/lib/http');
const { runHarness } = require('./lib/harness');
const { summarise, writeResults } = require('./lib/report');

const SEED_FILE = path.join(__dirname, 'seed-sequences.json');
const RESULTS_DIR = path.join(__dirname, 'results');

function loadSequences() {
  const raw = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  return raw.sequences;
}

function snapshotInfo() {
  const file = process.env.NEXTTRACK_CACHE_FILE || path.join(__dirname, '..', 'backend', 'data', 'cache', 'snapshot.json');
  const entries = fs.existsSync(file) ? Object.keys(http.loadCache()).length : 0;
  return { file: path.relative(process.cwd(), file), entries };
}

function progressLine(result) {
  const nt = result.systems.nexttrack;
  const winner = nt.ok ? `${nt.winner.artist} - ${nt.winner.title} (coherence ${nt.tagCoherence})` : `failed: ${nt.error.status} ${nt.error.message}`;
  console.log(`${result.id}: ${winner}`);
}

async function main() {
  http.configure({ rateLimit: false, persist: false });
  const snapshot = snapshotInfo();
  if (snapshot.entries === 0) {
    console.error(`No cache snapshot at ${snapshot.file}. Run \`npm run prime-cache\` in backend/ with a Last.fm API key first, then rerun the harness.`);
    process.exit(1);
  }
  const sequences = loadSequences();
  console.log(`Running ${sequences.length} sequences offline against ${snapshot.entries} cached responses`);
  const results = await runHarness(sequences, { onProgress: progressLine });
  const summary = summarise(results, { mode: 'offline', seedFile: path.relative(process.cwd(), SEED_FILE), snapshot });
  writeResults(RESULTS_DIR, summary, results);
  console.log('');
  for (const c of summary.criteria) console.log(`${c.pass === null ? 'n/a ' : c.pass ? 'PASS' : 'FAIL'}  ${c.statement}: ${c.measured}`);
  console.log(`\n${summary.sequences.failed} of ${summary.sequences.total} sequences had a failed run (see results.md). Results written to ${path.relative(process.cwd(), RESULTS_DIR)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
