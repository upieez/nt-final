const WIDTH = 720;
const HEIGHT = 360;
const MARGIN = { top: 48, right: 24, bottom: 64, left: 56 };
const COLOURS = ['#2f5d8a', '#c9782b', '#5a9e6f', '#8c5a9e', '#b04a4a'];
const FONT = 'font-family="Helvetica, Arial, sans-serif"';

function escape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function plotArea(width, height) {
  return { x: MARGIN.left, y: MARGIN.top, w: width - MARGIN.left - MARGIN.right, h: height - MARGIN.top - MARGIN.bottom };
}

function niceMax(values) {
  const max = Math.max(0, ...values.filter(Number.isFinite));
  if (max === 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(max)));
  const steps = [1, 2, 2.5, 5, 10];
  return steps.map((s) => s * power).find((s) => s >= max) || max;
}

function text(x, y, label, attrs = '') {
  return `<text x="${x}" y="${y}" ${FONT} font-size="12" ${attrs}>${escape(label)}</text>`;
}

function title(width, label) {
  return text(width / 2, 24, label, 'text-anchor="middle" font-size="15" font-weight="bold"');
}

// Horizontal gridlines with tick labels on the left; yMax maps to the top of the plot area
function yAxis(area, yMax, ticks = 5) {
  const parts = [];
  for (let i = 0; i <= ticks; i += 1) {
    const value = (yMax * i) / ticks;
    const y = area.y + area.h - (area.h * i) / ticks;
    parts.push(`<line x1="${area.x}" y1="${y}" x2="${area.x + area.w}" y2="${y}" stroke="#ddd" />`);
    parts.push(text(area.x - 6, y + 4, fmt(value), 'text-anchor="end" fill="#555"'));
  }
  return parts.join('');
}

function legend(series, width) {
  return series.map((s, i) => {
    const x = width - MARGIN.right - (series.length - i) * 130;
    return `<rect x="${x}" y="34" width="10" height="10" fill="${COLOURS[i % COLOURS.length]}" />${text(x + 14, 43, s.name)}`;
  }).join('');
}

function frame(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#fff" />${body}</svg>`;
}

// Grouped bars: one group per category, one bar per series; values may be null for missing data
function barChart({ title: label, categories, series, yMax, width = WIDTH, height = HEIGHT }) {
  const area = plotArea(width, height);
  const top = yMax || niceMax(series.flatMap((s) => s.values));
  const groupWidth = area.w / Math.max(1, categories.length);
  const barWidth = (groupWidth * 0.8) / Math.max(1, series.length);
  const bars = [];
  categories.forEach((category, ci) => {
    const groupX = area.x + ci * groupWidth + groupWidth * 0.1;
    series.forEach((s, si) => {
      const value = s.values[ci];
      if (!Number.isFinite(value)) return;
      const h = (Math.min(value, top) / top) * area.h;
      const x = groupX + si * barWidth;
      bars.push(`<rect x="${x.toFixed(1)}" y="${(area.y + area.h - h).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" fill="${COLOURS[si % COLOURS.length]}"><title>${escape(`${s.name}, ${category}: ${fmt(value)}`)}</title></rect>`);
    });
    bars.push(text(groupX + groupWidth * 0.4, area.y + area.h + 18, category, 'text-anchor="middle"'));
  });
  return frame(width, height, title(width, label) + legend(series, width) + yAxis(area, top) + bars.join(''));
}

// Counts values into equal bins over [lo, hi]; the last bin is closed on the right
function binCounts(values, bins, [lo, hi]) {
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const index = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)));
    counts[index] += 1;
  }
  return counts;
}

function histogram({ title: label, series, bins = 10, range = [0, 1], width = WIDTH, height = HEIGHT }) {
  const categories = [];
  for (let i = 0; i < bins; i += 1) {
    const lo = range[0] + ((range[1] - range[0]) * i) / bins;
    const hi = range[0] + ((range[1] - range[0]) * (i + 1)) / bins;
    categories.push(`${fmt(lo)}-${fmt(hi)}`);
  }
  const binned = series.map((s) => ({ name: s.name, values: binCounts(s.values, bins, range) }));
  return barChart({ title: label, categories, series: binned, width, height });
}

// One box per item from a five-number summary; whiskers span min to max
function boxSummary({ title: label, items, unit = '', width = WIDTH, height = HEIGHT }) {
  const area = plotArea(width, height);
  const top = niceMax(items.map((i) => i.max));
  const slot = area.w / Math.max(1, items.length);
  const boxWidth = slot * 0.4;
  const y = (value) => area.y + area.h - (Math.min(value, top) / top) * area.h;
  const boxes = items.map((item, i) => {
    const cx = area.x + slot * (i + 0.5);
    const left = cx - boxWidth / 2;
    return [
      `<line x1="${cx}" y1="${y(item.min)}" x2="${cx}" y2="${y(item.max)}" stroke="#555" />`,
      `<rect x="${left}" y="${y(item.p75)}" width="${boxWidth}" height="${Math.max(1, y(item.p25) - y(item.p75))}" fill="${COLOURS[i % COLOURS.length]}" fill-opacity="0.6" stroke="#333" />`,
      `<line x1="${left}" y1="${y(item.p50)}" x2="${left + boxWidth}" y2="${y(item.p50)}" stroke="#000" stroke-width="2" />`,
      text(cx, area.y + area.h + 18, item.name, 'text-anchor="middle"'),
      text(cx, area.y + area.h + 34, `p50 ${fmt(item.p50)}${unit}, max ${fmt(item.max)}${unit}`, 'text-anchor="middle" fill="#555" font-size="11"')
    ].join('');
  });
  return frame(width, height, title(width, label) + yAxis(area, top) + boxes.join(''));
}

module.exports = { barChart, histogram, boxSummary, binCounts, niceMax, escape };
