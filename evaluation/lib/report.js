const fs = require('fs');
const path = require('path');
const m = require('./metrics');
const svg = require('./svg');
const { SYSTEMS, SENSITIVITY, RANDOM_DRAWS, RANDOM_SEED } = require('./harness');

const GROUPS = ['coherent', 'mixed', 'sparse'];
const LABELS = { nexttrack: 'NextTrack', random: 'Random', popular: 'Most popular' };
const TARGETS = { winRate: 0.75, mbidRate: 0.8, sensitivity: 0.25, p95Ms: 2000 };

function okRuns(results, system) {
  return results.map((r) => r.systems[system]).filter((run) => run.ok);
}

function systemSummary(results, system) {
  const runs = okRuns(results, system);
  const byGroup = {};
  for (const group of GROUPS) byGroup[group] = m.round(m.mean(okRuns(results.filter((r) => r.group === group), system).map((run) => run.tagCoherence)));
  return {
    n: runs.length,
    failed: results.length - runs.length,
    tagCoherence: m.round(m.mean(runs.map((run) => run.tagCoherence))),
    tagCoherenceByGroup: byGroup,
    genreContinuation: m.round(m.mean(runs.map((run) => Number(run.genreContinuation)))),
    mbGenreContinuation: m.round(m.mean(runs.map((run) => (run.mbGenreContinuation === null ? NaN : Number(run.mbGenreContinuation))))),
    popularityPercentile: m.round(m.mean(runs.map((run) => run.popularityPercentile))),
    latencyMs: m.fiveNumber(runs.map((run) => run.latencyMs)),
    matchRate: m.round(m.mean(runs.map((run) => run.matchRate)))
  };
}

function bothBaselinesOk(r) {
  return r.systems.nexttrack.ok && r.systems.random.ok && r.systems.popular.ok;
}

// NextTrack wins a sequence on coherence when its cosine is strictly above both baselines
function coherenceWin(r) {
  const s = r.systems;
  return s.nexttrack.tagCoherence > s.random.tagCoherence && s.nexttrack.tagCoherence > s.popular.tagCoherence;
}

// On the boolean genre metric a win means NextTrack continues the genre and neither baseline does better
function genreWin(r) {
  const s = r.systems;
  const nt = Number(s.nexttrack.genreContinuation);
  return nt === 1 && nt >= Number(s.random.genreContinuation) && nt >= Number(s.popular.genreContinuation);
}

function winSummary(results, predicate) {
  const comparable = results.filter(bothBaselinesOk);
  const wins = comparable.filter(predicate).length;
  return { wins, of: comparable.length, rate: m.round(comparable.length ? wins / comparable.length : null), skipped: results.length - comparable.length };
}

// Seeds of a failed NextTrack run count as unresolved so the rate never flatters the pipeline
function seedSummary(results) {
  const bySource = { track: { seeds: 0, withMbid: 0 }, artist: { seeds: 0, withMbid: 0 }, none: { seeds: 0, withMbid: 0 } };
  let total = 0;
  let resolved = 0;
  let withMbid = 0;
  for (const r of results) {
    total += r.sequence.length;
    if (!r.systems.nexttrack.ok) {
      bySource.none.seeds += r.sequence.length;
      continue;
    }
    for (const seed of r.systems.nexttrack.seeds) {
      const bucket = bySource[seed.tagSource || 'none'];
      bucket.seeds += 1;
      if (seed.mbid) {
        bucket.withMbid += 1;
        withMbid += 1;
      }
      if (seed.resolved) resolved += 1;
    }
  }
  return { total, resolved, withMbid, resolvedRate: m.round(resolved / total), mbidRate: m.round(withMbid / total), byTagSource: bySource };
}

function poolSummary(results) {
  const pools = okRuns(results, 'nexttrack').map((run) => run.pool);
  const highDivergence = results.map((r) => r.sensitivity.divergence).filter((s) => s.ok).map((s) => s.high.contrast);
  return {
    size: m.fiveNumber(pools.map((p) => p.size)),
    dynamic: pools.filter((p) => p.mode === 'dynamic').length,
    fixed: pools.filter((p) => p.mode === 'fixed').length,
    scored: m.round(m.mean(pools.map((p) => p.scored))),
    scoreless: m.round(m.mean(pools.map((p) => p.scoreless))),
    excluded: m.round(m.mean(pools.map((p) => p.excluded))),
    contrastAtDefault: m.round(m.mean(pools.map((p) => p.contrast))),
    contrastAtHighDivergence: { mean: m.round(m.mean(highDivergence)), max: highDivergence.length ? Math.max(...highDivergence) : null, sequences: highDivergence.length }
  };
}

function sensitivitySummary(results) {
  const out = {};
  for (const { parameter, low, high } of SENSITIVITY) {
    const runs = results.map((r) => r.sensitivity[parameter]).filter((s) => s.ok);
    const changed = runs.filter((s) => s.changed).length;
    out[parameter] = { low, high, changed, of: runs.length, rate: m.round(runs.length ? changed / runs.length : null), failed: results.length - runs.length };
  }
  return out;
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function criteria(summary) {
  const p95 = summary.systems.nexttrack.latencyMs.p95;
  const list = [
    { id: 'coherence-wins', objective: 4, statement: `NextTrack beats both baselines on tag coherence in at least ${pct(TARGETS.winRate)} of sequences`, measured: pct(summary.wins.tagCoherence.rate), pass: summary.wins.tagCoherence.rate !== null ? summary.wins.tagCoherence.rate >= TARGETS.winRate : null },
    { id: 'genre-wins', objective: 4, statement: `NextTrack beats both baselines on genre continuation in at least ${pct(TARGETS.winRate)} of sequences`, measured: pct(summary.wins.genreContinuation.rate), pass: summary.wins.genreContinuation.rate !== null ? summary.wins.genreContinuation.rate >= TARGETS.winRate : null },
    { id: 'seed-mbid', objective: 2, statement: `at least ${pct(TARGETS.mbidRate)} of harness seeds resolve to an MBID`, measured: pct(summary.seeds.mbidRate), pass: summary.seeds.mbidRate >= TARGETS.mbidRate },
    { id: 'discovery-sensitivity', objective: 3, statement: `moving discoveryFactor from 0 to 1 changes the winner in at least ${pct(TARGETS.sensitivity)} of sequences`, measured: pct(summary.sensitivity.discoveryFactor.rate), pass: summary.sensitivity.discoveryFactor.rate !== null ? summary.sensitivity.discoveryFactor.rate >= TARGETS.sensitivity : null },
    { id: 'latency-p95', objective: 4, statement: `NextTrack p95 latency on a warm cache is under ${TARGETS.p95Ms} ms`, measured: p95 === null ? 'n/a' : `${p95} ms`, pass: p95 === null ? null : p95 < TARGETS.p95Ms },
    { id: 'error-paths', objective: 1, statement: 'every error path returns the documented status code', measured: 'backend jest suite (api.test.js)', pass: null },
    { id: 'blind-study', objective: 5, statement: 'median blind-study coherence for NextTrack is above random with at least ten raters', measured: 'evaluation/analyse-ratings.js', pass: null }
  ];
  return list;
}

function summarise(results, meta) {
  const systems = {};
  for (const system of SYSTEMS) systems[system] = systemSummary(results, system);
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: meta.mode,
    seedFile: meta.seedFile,
    snapshot: meta.snapshot,
    constants: { randomDraws: RANDOM_DRAWS, randomSeed: RANDOM_SEED, sensitivity: SENSITIVITY, targets: TARGETS },
    sequences: { total: results.length, byGroup: Object.fromEntries(GROUPS.map((g) => [g, results.filter((r) => r.group === g).length])), failed: results.filter((r) => !bothBaselinesOk(r)).length },
    systems,
    wins: { tagCoherence: winSummary(results, coherenceWin), genreContinuation: winSummary(results, genreWin) },
    seeds: seedSummary(results),
    pool: poolSummary(results),
    sensitivity: sensitivitySummary(results)
  };
  summary.criteria = criteria(summary);
  return summary;
}

function num(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function table(headers, rows) {
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function passLabel(pass) {
  if (pass === null) return 'not measured here';
  return pass ? 'pass' : 'fail';
}

function winnerLabel(run) {
  return run.ok ? `${run.winner.artist} - ${run.winner.title}` : `failed (${run.error.status})`;
}

function failures(results) {
  const rows = [];
  for (const r of results) {
    for (const system of SYSTEMS) if (!r.systems[system].ok) rows.push([r.id, system, r.systems[system].error.status, r.systems[system].error.message]);
    for (const { parameter } of SENSITIVITY) {
      const s = r.sensitivity[parameter];
      if (!s.ok) rows.push([r.id, `sensitivity ${parameter}`, s.error.status, s.error.message]);
    }
  }
  return rows;
}

function markdown(summary, results) {
  const s = summary;
  const parts = [
    '# Offline harness results',
    '',
    `Generated ${s.generatedAt} in ${s.mode} mode from \`${s.seedFile}\` using \`${s.snapshot.file}\` (${s.snapshot.entries} cached responses). ${s.sequences.total} sequences (${GROUPS.map((g) => `${s.sequences.byGroup[g]} ${g}`).join(', ')}), ${s.sequences.failed} with at least one failed system run. Random is the mean over ${s.constants.randomDraws} seeded draws (seed ${s.constants.randomSeed}). All latencies are cache-warm, offline latencies: no upstream call is made, so they measure the pipeline and cache lookups only.`,
    '',
    '## Success criteria',
    '',
    table(['Criterion', 'Objective', 'Measured', 'Result'], s.criteria.map((c) => [c.statement, c.objective, c.measured, passLabel(c.pass)])),
    '',
    '## Systems',
    '',
    table(['System', 'Runs', 'Mean tag coherence', 'Genre continuation (tag or genre)', 'Genre continuation (MusicBrainz genre only)', 'Mean popularity percentile', 'Latency p50 (ms)', 'Latency p95 (ms)', 'Match rate'],
      SYSTEMS.map((k) => [LABELS[k], `${s.systems[k].n}/${s.systems[k].n + s.systems[k].failed}`, num(s.systems[k].tagCoherence), pct(s.systems[k].genreContinuation), pct(s.systems[k].mbGenreContinuation), num(s.systems[k].popularityPercentile), s.systems[k].latencyMs.p50 ?? 'n/a', s.systems[k].latencyMs.p95 ?? 'n/a', num(s.systems[k].matchRate)])),
    '',
    `NextTrack beats both baselines on tag coherence in ${s.wins.tagCoherence.wins} of ${s.wins.tagCoherence.of} comparable sequences (${pct(s.wins.tagCoherence.rate)}) and on genre continuation in ${s.wins.genreContinuation.wins} of ${s.wins.genreContinuation.of} (${pct(s.wins.genreContinuation.rate)}). A genre win means NextTrack shares a tag or genre with the most recent seed and neither baseline scores higher on that flag.`,
    '',
    '## Tag coherence by sequence group',
    '',
    table(['System', ...GROUPS], SYSTEMS.map((k) => [LABELS[k], ...GROUPS.map((g) => num(s.systems[k].tagCoherenceByGroup[g]))])),
    '',
    '## Parameter sensitivity',
    '',
    table(['Parameter', 'Low', 'High', 'Winner changed', 'Rate'], SENSITIVITY.map(({ parameter }) => [parameter, s.sensitivity[parameter].low, s.sensitivity[parameter].high, `${s.sensitivity[parameter].changed}/${s.sensitivity[parameter].of}`, pct(s.sensitivity[parameter].rate)])),
    '',
    `At divergence 1 the pool held on average ${num(s.pool.contrastAtHighDivergence.mean, 1)} contrast candidates from unrelated tag charts (max ${s.pool.contrastAtHighDivergence.max ?? 'n/a'}) across ${s.pool.contrastAtHighDivergence.sequences} sequences.`,
    '',
    '## Seeds and reconciliation',
    '',
    table(['Measure', 'Value'], [
      ['Seeds', s.seeds.total],
      ['Resolved to tags or genres', `${s.seeds.resolved} (${pct(s.seeds.resolvedRate)})`],
      ['Resolved to an MBID', `${s.seeds.withMbid} (${pct(s.seeds.mbidRate)})`],
      ['MBID rate, track-level tags', `${s.seeds.byTagSource.track.withMbid}/${s.seeds.byTagSource.track.seeds}`],
      ['MBID rate, artist-level tags', `${s.seeds.byTagSource.artist.withMbid}/${s.seeds.byTagSource.artist.seeds}`],
      ['MBID rate, no tags', `${s.seeds.byTagSource.none.withMbid}/${s.seeds.byTagSource.none.seeds}`],
      ['Mean per-request match rate (seeds and candidates)', num(s.systems.nexttrack.matchRate)]
    ]),
    '',
    '## Candidate pool',
    '',
    table(['Measure', 'Value'], [
      ['Pool size min / p50 / max', `${s.pool.size.min ?? 'n/a'} / ${s.pool.size.p50 ?? 'n/a'} / ${s.pool.size.max ?? 'n/a'}`],
      ['Dynamic / fixed fallback', `${s.pool.dynamic} / ${s.pool.fixed}`],
      ['Mean scored / scoreless / excluded', `${num(s.pool.scored, 1)} / ${num(s.pool.scoreless, 1)} / ${num(s.pool.excluded, 1)}`]
    ]),
    '',
    '## Per sequence',
    '',
    table(['Sequence', 'Group', 'NextTrack winner', 'NT coherence', 'Random coherence', 'Popular coherence', 'NT genre', 'NT popularity pct', 'discovery changed', 'strictness changed', 'divergence changed'],
      results.map((r) => [r.id, r.group, winnerLabel(r.systems.nexttrack), num(r.systems.nexttrack.tagCoherence), num(r.systems.random.tagCoherence), num(r.systems.popular.tagCoherence), r.systems.nexttrack.ok ? (r.systems.nexttrack.genreContinuation ? 'yes' : 'no') : 'n/a', num(r.systems.nexttrack.popularityPercentile, 2), ...SENSITIVITY.map(({ parameter }) => (r.sensitivity[parameter].ok ? (r.sensitivity[parameter].changed ? 'yes' : 'no') : 'n/a'))]))
  ];
  const failed = failures(results);
  parts.push('', '## Failed runs', '', failed.length ? table(['Sequence', 'Run', 'Status', 'Message'], failed) : 'None.');
  return `${parts.join('\n')}\n`;
}

function charts(summary, results) {
  const percentiles = (system) => okRuns(results, system).map((run) => run.popularityPercentile);
  return {
    'coherence-by-group.svg': svg.barChart({ title: 'Mean tag coherence by sequence group', categories: GROUPS, yMax: 1, series: SYSTEMS.map((k) => ({ name: LABELS[k], values: GROUPS.map((g) => summary.systems[k].tagCoherenceByGroup[g]) })) }),
    'popularity-percentile.svg': svg.histogram({ title: 'Winner popularity percentile within the pool', bins: 10, series: SYSTEMS.map((k) => ({ name: LABELS[k], values: percentiles(k) })) }),
    'sensitivity.svg': svg.barChart({ title: 'Share of sequences where the winner changed between the low and high setting', categories: SENSITIVITY.map((s) => s.parameter), yMax: 1, series: [{ name: 'NextTrack', values: SENSITIVITY.map((s) => summary.sensitivity[s.parameter].rate) }] }),
    'latency.svg': svg.boxSummary({ title: 'Cache-warm latency per system (ms)', unit: ' ms', items: SYSTEMS.map((k) => ({ name: LABELS[k], ...summary.systems[k].latencyMs })) })
  };
}

function writeResults(dir, summary, results) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'results.json'), `${JSON.stringify({ summary, sequences: results }, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'results.md'), markdown(summary, results));
  for (const [name, content] of Object.entries(charts(summary, results))) fs.writeFileSync(path.join(dir, name), content);
}

module.exports = { summarise, markdown, charts, writeResults, GROUPS, TARGETS };
