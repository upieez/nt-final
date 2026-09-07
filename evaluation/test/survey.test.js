const fs = require('fs');
const path = require('path');
const { parseCsv, readRecords } = require('../lib/csv');
const { matchColumns, splitCheckbox, analyseSurvey, surveyMarkdown, likertCharts, QUESTIONS } = require('../lib/survey');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'survey.csv'), 'utf8');

describe('csv reader', () => {
  test('handles quoted commas, doubled quotes, embedded newlines and CRLF', () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\r\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere']]);
  });

  test('reads records keyed by header and drops blank lines', () => {
    const { headers, records } = readRecords('h1,h2\n1,2\n\n3,4\n');
    expect(headers).toEqual(['h1', 'h2']);
    expect(records).toEqual([{ h1: '1', h2: '2' }, { h1: '3', h2: '4' }]);
  });
});

describe('survey analyser', () => {
  const analysis = analyseSurvey(readRecords(FIXTURE));

  test('matches all sixteen questions by keyword and leaves the timestamp unmatched', () => {
    const columns = matchColumns(readRecords(FIXTURE).headers);
    expect(columns.size).toBe(QUESTIONS.length);
    expect(columns.get('Q4')).toMatch(/satisfied/);
    expect(columns.get('Q16')).toBe('Age range');
    expect(analysis.unmatched).toEqual(['Timestamp']);
  });

  test('splits checkbox cells on known options and keeps the rest as other', () => {
    const q3 = QUESTIONS.find((q) => q.id === 'Q3');
    const split = splitCheckbox('A playlist someone else made (friend, editorial, algorithmic playlist), Radio / DJ decides, My cat picks', q3.options);
    expect(split.picked).toEqual(['A playlist someone else made (friend, editorial, algorithmic playlist)', 'Radio / DJ decides']);
    expect(split.other).toEqual(['my cat picks']);
    const q13 = analysis.questions.find((q) => q.id === 'Q13');
    expect(q13.counts.find((c) => c.answer.startsWith('Discovery level')).count).toBe(2);
    expect(q13.counts.find((c) => c.answer.startsWith('None')).count).toBe(1);
  });

  test('computes likert means, medians and distributions from answered cells only', () => {
    const q4 = analysis.questions.find((q) => q.id === 'Q4');
    expect(q4.answered).toBe(3);
    expect(q4.mean).toBe(3);
    expect(q4.median).toBe(3);
    expect(q4.distribution.map((d) => d.count)).toEqual([0, 1, 1, 1, 0]);
  });

  test('reports the three motivation checks', () => {
    expect(analysis.motivation.sharedAccountConfusion).toEqual({ confused: 2, sharers: 3, rate: 0.667 });
    expect(analysis.motivation.selfCensoring).toEqual({ yes: 2, of: 4, rate: 0.5 });
    expect(analysis.motivation.historyComfort).toEqual({ mean: 2.5, median: 2.5, n: 4 });
  });

  test('writes markdown with per-question tables, free text and one chart per likert question', () => {
    const md = surveyMarkdown(analysis, 'survey.csv');
    expect(md).toContain('4 responses');
    expect(md).toContain('| Yes, regularly | 2 | 50% |');
    expect(md).toContain('- Too much of the same, never surprises me');
    expect(md).toContain('Unmatched columns: `Timestamp`');
    expect(Object.keys(likertCharts(analysis)).sort()).toEqual(['survey-q10.svg', 'survey-q12.svg', 'survey-q14.svg', 'survey-q4.svg', 'survey-q8.svg']);
  });

  test('marks a question missing when no column matches', () => {
    const partial = analyseSurvey(readRecords('Timestamp,How often do you listen to music?\n1,Occasionally\n'));
    expect(partial.questions.find((q) => q.id === 'Q1').counts).toEqual([{ answer: 'Occasionally', count: 1 }]);
    expect(partial.questions.find((q) => q.id === 'Q8').missing).toBe(true);
    expect(partial.motivation.historyComfort).toBeNull();
    expect(surveyMarkdown(partial, 'x.csv')).toContain('No matching column in the export.');
  });
});
