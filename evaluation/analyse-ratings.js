// Summarises evaluation/ratings.jsonl from the blind study into evaluation/results/ratings.md
const fs = require('fs');
const path = require('path');
const { parseRatings, analyseRatings, ratingsMarkdown, ratingsChart } = require('./lib/ratings');

const RESULTS_DIR = path.join(__dirname, 'results');

function main() {
  const file = process.argv[2] || process.env.RATINGS_FILE || path.join(__dirname, 'ratings.jsonl');
  if (!fs.existsSync(file)) {
    console.error(`No ratings file at ${file}. Ratings are appended by POST /api/v1/study/rate when the frontend study runs.`);
    process.exit(1);
  }
  const analysis = analyseRatings(parseRatings(fs.readFileSync(file, 'utf8')));
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, 'ratings.md'), ratingsMarkdown(analysis, path.basename(file)));
  fs.writeFileSync(path.join(RESULTS_DIR, 'ratings.json'), `${JSON.stringify(analysis, null, 2)}\n`);
  fs.writeFileSync(path.join(RESULTS_DIR, 'ratings.svg'), ratingsChart(analysis));
  console.log(`${analysis.trials} trials analysed${analysis.skipped ? `, ${analysis.skipped} malformed lines skipped` : ''}. Written to ${path.relative(process.cwd(), RESULTS_DIR)}/ratings.md`);
}

main();
