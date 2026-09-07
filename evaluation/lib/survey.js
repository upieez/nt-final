const m = require('./metrics');
const svg = require('./svg');

// Questions from report/sources/nexttrack-user-survey.md; headers are matched on keywords, not exact wording
const QUESTIONS = [
  { id: 'Q1', label: 'How often do you listen to music', type: 'choice', keywords: [/how often/] },
  { id: 'Q2', label: 'Services used to listen', type: 'checkbox', keywords: [/use to listen/, /which of these do you use/], options: ['Spotify', 'Apple Music', 'YouTube / YouTube Music', 'Bandcamp / SoundCloud', 'Radio', 'Local files / downloads'] },
  { id: 'Q3', label: 'How the next song is usually chosen', type: 'checkbox', keywords: [/next song/, /song ends/], options: ["The app's autoplay / algorithm decides", 'A playlist I made myself', 'A playlist someone else made (friend, editorial, algorithmic playlist)', 'I search for and pick each song manually', 'Radio / DJ decides'] },
  { id: 'Q4', label: 'Satisfaction with automatic next songs (1 very dissatisfied, 5 very satisfied)', type: 'likert', keywords: [/satisfied/] },
  { id: 'Q5', label: 'Shares a music account or speaker', type: 'choice', keywords: [/share a music/, /speaker with other/] },
  { id: 'Q6', label: 'Seen recommendations meant for someone else', type: 'choice', keywords: [/someone else/, /meant for/] },
  { id: 'Q7', label: 'Avoided a song or genre to protect recommendations', type: 'choice', keywords: [/avoided/, /mess up/] },
  { id: 'Q8', label: 'Comfort with permanent listening history storage (1 very uncomfortable, 5 completely comfortable)', type: 'likert', keywords: [/comfortable/, /listening history/] },
  { id: 'Q9', label: 'What frustrates you most about music recommendations', type: 'text', keywords: [/frustrates/] },
  { id: 'Q10', label: 'Usefulness of the NextTrack concept (1 not useful, 5 extremely useful)', type: 'likert', keywords: [/useful/] },
  { id: 'Q11', label: 'Situations of use', type: 'checkbox', keywords: [/situations/], options: ['Discovering new music', 'Parties or gatherings (music for a mixed group)', 'Road trips / shared car rides', "When my current mood doesn't match my usual taste", 'Building playlists', 'Background music while working/studying', "I probably wouldn't use it"] },
  { id: 'Q12', label: 'Importance of an explanation (1 do not care, 5 very important)', type: 'likert', keywords: [/explain/] },
  { id: 'Q13', label: 'Controls respondents would use', type: 'checkbox', keywords: [/controls/], options: ['Genre strictness (stay close to the seed songs\' genre)', 'Discovery level (more mainstream - more obscure)', 'Era / decade filter', 'Mood filter', 'Tempo / energy filter', 'Exclude specific artists', "None - I'd rather it just work without settings"] },
  { id: 'Q14', label: 'Preference for known versus new songs (1 songs I know, 5 new songs)', type: 'likert', keywords: [/prefer/] },
  { id: 'Q15', label: 'Relationship with music', type: 'choice', keywords: [/relationship/] },
  { id: 'Q16', label: 'Age range', type: 'choice', keywords: [/age range/, /\bage\b/] }
];

const YES_ANSWERS = /^yes/i;
const NOT_APPLICABLE = /not applicable|don.?t share/i;

// Lowercase, dashes and arrows unified, whitespace collapsed, so option wording survives small edits
function canon(value) {
  return String(value || '').toLowerCase().replace(/[\u2010-\u2015\u2190-\u2195]/g, '-').replace(/\u2019/g, "'").replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-').trim();
}

// First unassigned header containing a keyword, tried in question order so Q16's "age" cannot steal Q4
function matchColumns(headers) {
  const assigned = new Map();
  const taken = new Set();
  for (const q of QUESTIONS) {
    const header = headers.find((h) => !taken.has(h) && q.keywords.some((k) => k.test(h.toLowerCase())));
    if (!header) continue;
    assigned.set(q.id, header);
    taken.add(header);
  }
  return assigned;
}

function countBy(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([answer, count]) => ({ answer, count }));
}

// Google Forms joins ticked boxes with ", ", so known options are removed first and the rest is "Other"
function splitCheckbox(cell, options) {
  let rest = canon(cell);
  const picked = [];
  for (const option of options) {
    const key = canon(option);
    if (rest.includes(key)) {
      picked.push(option);
      rest = rest.replace(key, '');
    }
  }
  const other = rest.split(',').map((s) => s.trim()).filter(Boolean);
  return { picked, other };
}

function likertValue(cell) {
  const n = Number(String(cell).trim().charAt(0));
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function analyseQuestion(q, answers) {
  const given = answers.filter((a) => a !== '');
  const base = { id: q.id, label: q.label, type: q.type, answered: given.length };
  if (q.type === 'likert') {
    const values = given.map(likertValue).filter((v) => v !== null);
    const distribution = [1, 2, 3, 4, 5].map((level) => ({ answer: String(level), count: values.filter((v) => v === level).length }));
    return { ...base, answered: values.length, mean: m.round(m.mean(values), 2), median: m.median(values), distribution };
  }
  if (q.type === 'checkbox') {
    const split = given.map((cell) => splitCheckbox(cell, q.options));
    const counts = q.options.map((option) => ({ answer: option, count: split.filter((s) => s.picked.includes(option)).length }));
    const other = split.flatMap((s) => s.other);
    if (other.length) counts.push({ answer: `Other (${other.join('; ')})`, count: other.length });
    return { ...base, counts: counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count) };
  }
  if (q.type === 'text') return { ...base, responses: given };
  return { ...base, counts: countBy(given) };
}

// Motivation checks that Chapter 1 relies on: shared-account confusion, self-censoring and history comfort
function countsOf(question) {
  return question && question.counts ? question.counts : [];
}

function motivationChecks(byId) {
  const q6 = countsOf(byId.Q6).filter((c) => !NOT_APPLICABLE.test(c.answer));
  const sharers = q6.reduce((s, c) => s + c.count, 0);
  const confused = q6.filter((c) => YES_ANSWERS.test(c.answer)).reduce((s, c) => s + c.count, 0);
  const q7 = countsOf(byId.Q7);
  const q7Total = q7.reduce((s, c) => s + c.count, 0);
  const censoring = q7.filter((c) => YES_ANSWERS.test(c.answer)).reduce((s, c) => s + c.count, 0);
  return {
    sharedAccountConfusion: { confused, sharers, rate: m.round(sharers ? confused / sharers : null) },
    selfCensoring: { yes: censoring, of: q7Total, rate: m.round(q7Total ? censoring / q7Total : null) },
    historyComfort: byId.Q8 && !byId.Q8.missing ? { mean: byId.Q8.mean, median: byId.Q8.median, n: byId.Q8.answered } : null
  };
}

function analyseSurvey({ headers, records }) {
  const columns = matchColumns(headers);
  const questions = QUESTIONS.map((q) => (columns.has(q.id) ? analyseQuestion(q, records.map((r) => r[columns.get(q.id)] || '')) : { id: q.id, label: q.label, type: q.type, missing: true }));
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  return {
    respondents: records.length,
    matched: [...columns.entries()].map(([id, header]) => ({ id, header })),
    unmatched: headers.filter((h) => ![...columns.values()].includes(h)),
    questions,
    motivation: motivationChecks(byId)
  };
}

function pct(count, total) {
  return total ? `${((count / total) * 100).toFixed(0)}%` : 'n/a';
}

function table(headers, rows) {
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function questionSection(q, respondents) {
  const head = `### ${q.id}. ${q.label}`;
  if (q.missing) return `${head}\n\nNo matching column in the export.`;
  if (q.type === 'text') return `${head}\n\n${q.answered} responses.\n\n${q.responses.map((r) => `- ${r.replace(/\n+/g, ' ')}`).join('\n') || '(none)'}`;
  if (q.type === 'likert') {
    return `${head}\n\n${q.answered} answered, mean ${q.mean ?? 'n/a'}, median ${q.median ?? 'n/a'}.\n\n${table(['Score', 'Count', 'Share'], q.distribution.map((d) => [d.answer, d.count, pct(d.count, q.answered)]))}\n\n![${q.id}](survey-${q.id.toLowerCase()}.svg)`;
  }
  const note = q.type === 'checkbox' ? 'Shares are of respondents who answered; multiple answers allowed.' : `${q.answered} of ${respondents} answered.`;
  return `${head}\n\n${note}\n\n${table(['Answer', 'Count', 'Share'], q.counts.map((c) => [c.answer, c.count, pct(c.count, q.answered)]))}`;
}

function surveyMarkdown(analysis, source) {
  const mo = analysis.motivation;
  const parts = [
    '# User survey results',
    '',
    `${analysis.respondents} responses from \`${source}\`. Convenience sample from the author\'s own network, indicative only.`,
    '',
    '## Motivation checks',
    '',
    table(['Check', 'Value'], [
      ['Shared-account confusion (Q6, among respondents who share)', `${mo.sharedAccountConfusion.confused}/${mo.sharedAccountConfusion.sharers} (${pct(mo.sharedAccountConfusion.confused, mo.sharedAccountConfusion.sharers)})`],
      ['Self-censoring to protect recommendations (Q7)', `${mo.selfCensoring.yes}/${mo.selfCensoring.of} (${pct(mo.selfCensoring.yes, mo.selfCensoring.of)})`],
      ['Comfort with permanent history storage (Q8 mean, 1 to 5)', mo.historyComfort ? `${mo.historyComfort.mean} (median ${mo.historyComfort.median}, n ${mo.historyComfort.n})` : 'n/a']
    ]),
    '',
    '## Questions',
    '',
    ...analysis.questions.map((q) => `${questionSection(q, analysis.respondents)}\n`),
    '## Column matching',
    '',
    table(['Question', 'Column header'], analysis.matched.map((x) => [x.id, x.header.replace(/\|/g, '/')])),
    '',
    analysis.unmatched.length ? `Unmatched columns: ${analysis.unmatched.map((h) => `\`${h}\``).join(', ')}.` : 'Every column was matched.'
  ];
  return `${parts.join('\n')}\n`;
}

function likertCharts(analysis) {
  const charts = {};
  for (const q of analysis.questions) {
    if (q.type !== 'likert' || q.missing) continue;
    charts[`survey-${q.id.toLowerCase()}.svg`] = svg.barChart({ title: `${q.id}: ${q.label}`, categories: q.distribution.map((d) => d.answer), series: [{ name: `responses (n ${q.answered})`, values: q.distribution.map((d) => d.count) }], width: 520, height: 300 });
  }
  return charts;
}

module.exports = { QUESTIONS, matchColumns, splitCheckbox, analyseSurvey, surveyMarkdown, likertCharts };
