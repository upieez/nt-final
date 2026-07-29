const FEATURING = /[([]?\s*\b(feat|ft|featuring)\.?\s.*$/;
const NOISE_WORDS = '(remaster(ed)?|live|remix|mix|version|edit|mono|stereo|demo|deluxe|bonus|acoustic|instrumental|radio|explicit|clean|anniversary|\\d{4})';
const BRACKETED_NOISE = new RegExp(`\\s*[([][^)\\]]*\\b${NOISE_WORDS}\\b[^)\\]]*[)\\]]`, 'g');
const DASHED_NOISE = new RegExp(`\\s+-\\s+[^-]*\\b${NOISE_WORDS}\\b.*$`);
const COMBINING_MARKS = /[̀-ͯ]/g;

function stripDiacritics(value) {
  return value.normalize('NFKD').replace(COMBINING_MARKS, '');
}

// Canonical form used for cross-source matching and de-duplication, never shown to users
function normaliseName(value, { keepThe = false } = {}) {
  if (typeof value !== 'string') return '';
  let name = stripDiacritics(value.toLowerCase());
  name = name.replace(FEATURING, '');
  name = name.replace(BRACKETED_NOISE, '').replace(DASHED_NOISE, '');
  name = name.replace(/['’]/g, '').replace(/&/g, ' and ');
  name = name.replace(/[^a-z0-9]+/g, ' ').trim();
  if (!keepThe && name.startsWith('the ') && name !== 'the the') name = name.slice(4);
  return name;
}

function trackKey(artist, title) {
  return `${normaliseName(artist)}|${normaliseName(title)}`;
}

function sameName(a, b) {
  return normaliseName(a) === normaliseName(b) && normaliseName(a) !== '';
}

module.exports = { normaliseName, trackKey, sameName };
