const m = require('./metrics');
const svg = require('./svg');

const SYSTEMS = ['nexttrack', 'random', 'popular'];
const LABELS = { nexttrack: 'NextTrack', random: 'Random', popular: 'Most popular' };
const MIN_TRIALS = 10;

function validResult(r) {
  return r && SYSTEMS.includes(r.system) && Number.isInteger(r.coherence) && Number.isInteger(r.novelty) && typeof r.wouldPlay === 'boolean';
}

// One trial per line as written by backend/lib/study.js; malformed lines are counted, never guessed at
function parseRatings(text) {
  const trials = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      const results = Array.isArray(parsed.results) ? parsed.results : [];
      const complete = SYSTEMS.every((system) => results.some((r) => validResult(r) && r.system === system));
      if (!complete) throw new Error('incomplete');
      trials.push({ ratedAt: parsed.ratedAt || null, bySystem: Object.fromEntries(results.filter(validResult).map((r) => [r.system, r])) });
    } catch (err) {
      skipped += 1;
    }
  }
  return { trials, skipped };
}

function systemStats(trials, system) {
  const rows = trials.map((t) => t.bySystem[system]);
  return {
    trials: rows.length,
    meanCoherence: m.round(m.mean(rows.map((r) => r.coherence)), 2),
    medianCoherence: m.median(rows.map((r) => r.coherence)),
    meanNovelty: m.round(m.mean(rows.map((r) => r.novelty)), 2),
    wouldPlayRate: m.round(m.rate(rows.map((r) => r.wouldPlay)))
  };
}

// The system with the strictly highest coherence in a trial is preferred; equal tops count as a tie
function preferenceCounts(trials) {
  const counts = Object.fromEntries([...SYSTEMS, 'tie'].map((k) => [k, 0]));
  for (const t of trials) {
    const top = Math.max(...SYSTEMS.map((s) => t.bySystem[s].coherence));
    const leaders = SYSTEMS.filter((s) => t.bySystem[s].coherence === top);
    counts[leaders.length === 1 ? leaders[0] : 'tie'] += 1;
  }
  return counts;
}

function paired(trials, baseline, field) {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const t of trials) {
    const a = Number(t.bySystem.nexttrack[field]);
    const b = Number(t.bySystem[baseline][field]);
    if (a > b) wins += 1;
    else if (a < b) losses += 1;
    else ties += 1;
  }
  const test = m.signTest(wins, losses);
  return { baseline, field, wins, losses, ties, shareHigher: m.round(trials.length ? wins / trials.length : null), pValue: test.pValue === null ? null : m.round(test.pValue, 4) };
}

function analyseRatings({ trials, skipped }) {
  const systems = Object.fromEntries(SYSTEMS.map((s) => [s, systemStats(trials, s)]));
  const nt = systems.nexttrack.medianCoherence;
  const rnd = systems.random.medianCoherence;
  return {
    trials: trials.length,
    skipped,
    firstRatedAt: trials.length ? trials.map((t) => t.ratedAt).filter(Boolean).sort()[0] || null : null,
    lastRatedAt: trials.length ? trials.map((t) => t.ratedAt).filter(Boolean).sort().pop() || null : null,
    systems,
    preference: preferenceCounts(trials),
    paired: ['random', 'popular'].flatMap((b) => [paired(trials, b, 'coherence'), paired(trials, b, 'novelty'), paired(trials, b, 'wouldPlay')]),
    criterion: {
      statement: `NextTrack median coherence above random with at least ${MIN_TRIALS} trials (the file holds no rater ids, so trials stand in for raters)`,
      medianNexttrack: nt,
      medianRandom: rnd,
      pass: trials.length >= MIN_TRIALS && nt !== null && rnd !== null ? nt > rnd : null
    }
  };
}

function table(headers, rows) {
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(0)}%` : 'n/a';
}

function ratingsMarkdown(a, source) {
  const parts = [
    '# Blind rating study results',
    '',
    `${a.trials} complete trials from \`${source}\`${a.skipped ? ` (${a.skipped} malformed lines skipped)` : ''}${a.firstRatedAt ? `, rated between ${a.firstRatedAt} and ${a.lastRatedAt}` : ''}. Each trial rated the NextTrack, random and most-popular picks for one seed sequence in a shuffled order; the file holds no rater or sequence identifiers, so counts are per trial.`,
    '',
    '## Per system',
    '',
    table(['System', 'Trials', 'Mean coherence', 'Median coherence', 'Mean novelty', 'Would play'], SYSTEMS.map((s) => [LABELS[s], a.systems[s].trials, a.systems[s].meanCoherence ?? 'n/a', a.systems[s].medianCoherence ?? 'n/a', a.systems[s].meanNovelty ?? 'n/a', pct(a.systems[s].wouldPlayRate)])),
    '',
    '## Preferred system per trial (highest coherence rating)',
    '',
    table(['System', 'Trials preferred'], [...SYSTEMS.map((s) => [LABELS[s], a.preference[s]]), ['Tie', a.preference.tie]]),
    '',
    '## Paired comparison, NextTrack against each baseline',
    '',
    table(['Baseline', 'Rating', 'NextTrack higher', 'Lower', 'Tied', 'Share higher', 'Sign test p (two-sided)'], a.paired.map((p) => [LABELS[p.baseline], p.field, p.wins, p.losses, p.ties, pct(p.shareHigher), p.pValue ?? 'n/a'])),
    '',
    '## Success criterion',
    '',
    `${a.criterion.statement}: NextTrack median ${a.criterion.medianNexttrack ?? 'n/a'}, random median ${a.criterion.medianRandom ?? 'n/a'}, ${a.criterion.pass === null ? 'not evaluable yet' : a.criterion.pass ? 'pass' : 'fail'}.`,
    '',
    '![ratings](ratings.svg)'
  ];
  return `${parts.join('\n')}\n`;
}

function ratingsChart(a) {
  return svg.barChart({
    title: 'Blind study ratings per system',
    categories: ['mean coherence (1-5)', 'mean novelty (1-5)', 'would play (x5)'],
    yMax: 5,
    series: SYSTEMS.map((s) => ({ name: LABELS[s], values: [a.systems[s].meanCoherence, a.systems[s].meanNovelty, a.systems[s].wouldPlayRate === null ? null : a.systems[s].wouldPlayRate * 5] }))
  });
}

module.exports = { parseRatings, analyseRatings, ratingsMarkdown, ratingsChart, MIN_TRIALS };
