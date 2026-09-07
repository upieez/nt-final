// Summarises a Google Forms CSV export of the user survey into evaluation/results/survey.md
const fs = require('fs');
const path = require('path');
const { readRecords } = require('./lib/csv');
const { analyseSurvey, surveyMarkdown, likertCharts } = require('./lib/survey');

const RESULTS_DIR = path.join(__dirname, 'results');

function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: node evaluation/analyse-survey.js <google-forms-export.csv>');
    process.exit(1);
  }
  const analysis = analyseSurvey(readRecords(fs.readFileSync(file, 'utf8')));
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, 'survey.md'), surveyMarkdown(analysis, path.basename(file)));
  fs.writeFileSync(path.join(RESULTS_DIR, 'survey.json'), `${JSON.stringify(analysis, null, 2)}\n`);
  for (const [name, content] of Object.entries(likertCharts(analysis))) fs.writeFileSync(path.join(RESULTS_DIR, name), content);
  console.log(`${analysis.respondents} responses, ${analysis.matched.length} of 16 questions matched${analysis.unmatched.length ? `, unmatched columns: ${analysis.unmatched.join(' | ')}` : ''}`);
  console.log(`Written to ${path.relative(process.cwd(), RESULTS_DIR)}/survey.md`);
}

main();
