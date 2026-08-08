// Builders that produce upstream response bodies in the exact shapes the real APIs use

function lastfmTags(tags) {
  return { toptags: { tag: tags.map(([name, count]) => ({ count, name, url: `https://www.last.fm/tag/${encodeURIComponent(name)}` })), '@attr': {} } };
}

function lastfmTrackInfo({ artist, title, listeners = 1000, mbid = '', artistMbid = '' }) {
  return {
    track: {
      name: title, mbid, url: '', duration: '200000', streamable: { '#text': '0', fulltrack: '0' },
      listeners: String(listeners), playcount: String(listeners * 5),
      artist: { name: artist, mbid: artistMbid, url: '' }, toptags: { tag: [] }
    }
  };
}

function lastfmSimilarTracks(tracks) {
  return { similartracks: { track: tracks.map(([artist, title, match, playcount]) => ({ name: title, playcount, mbid: '', match, url: '', streamable: { '#text': '0', fulltrack: '0' }, duration: 200, artist: { name: artist, mbid: '', url: '' } })), '@attr': {} } };
}

function lastfmSimilarArtists(artists) {
  return { similarartists: { artist: artists.map(([name, match]) => ({ name, mbid: '', match: String(match), url: '', image: [], streamable: '0' })), '@attr': {} } };
}

function lastfmTopTracks(artist, tracks) {
  return { toptracks: { track: tracks.map(([title, listeners], i) => ({ name: title, playcount: String(listeners * 4), listeners: String(listeners), mbid: '', url: '', streamable: '0', artist: { name: artist, mbid: '', url: '' }, image: [], '@attr': { rank: String(i + 1) } })), '@attr': { artist } } };
}

function lastfmSearch(tracks) {
  return { results: { 'opensearch:totalResults': String(tracks.length), trackmatches: { track: tracks.map(([artist, title, listeners]) => ({ name: title, artist, url: '', streamable: 'FIXME', listeners: String(listeners), image: [], mbid: '' })) }, '@attr': {} } };
}

function mbRecording({ id, title, artist, artistId, score = 100, isrcs = [], genres = [], tags = [] }) {
  return {
    id, score, title, length: 200000, video: null,
    'artist-credit': [{ name: artist, artist: { id: artistId, name: artist, 'sort-name': artist, disambiguation: '' } }],
    releases: [],
    isrcs,
    genres: genres.map((name, i) => ({ id: `g-${i}`, name, count: 1, disambiguation: '' })),
    tags: tags.map((name) => ({ count: 1, name }))
  };
}

function mbSearch(recordings) {
  return { created: '2026-08-01T10:00:00.000Z', count: recordings.length, offset: 0, recordings: recordings.map(mbRecording) };
}

function mbArtist({ id, name, country = null, genres = [], wikidataId = null, type = 'Group' }) {
  const relations = wikidataId
    ? [{ type: 'wikidata', 'type-id': '689870a4-a1e4-4912-b17f-7b2664215698', direction: 'forward', 'target-type': 'url', ended: false, attributes: [], begin: null, end: null, url: { id: `url-${wikidataId}`, resource: `https://www.wikidata.org/wiki/${wikidataId}` } }]
    : [];
  return {
    id, name, 'sort-name': name, type, disambiguation: '', country, area: null, 'begin-area': null, 'end-area': null,
    'life-span': { begin: null, end: null, ended: false }, isnis: [], ipis: [],
    genres: genres.map((g, i) => ({ id: `g-${i}`, name: g, count: 5 - i, disambiguation: '' })),
    tags: genres.map((g, i) => ({ count: 5 - i, name: g })),
    relations
  };
}

function wdBinding(prop, qid, label) {
  return {
    prop: { type: 'uri', value: `http://www.wikidata.org/prop/direct/${prop}` },
    value: { type: 'uri', value: `http://www.wikidata.org/entity/${qid}` },
    valueLabel: { 'xml:lang': 'en', type: 'literal', value: label }
  };
}

function wdRelations({ genres = [], labels = [], country = null, members = [], memberOf = [] }) {
  const bindings = [];
  genres.forEach((g, i) => bindings.push(wdBinding('P136', `Q10${i}`, g)));
  labels.forEach((l, i) => bindings.push(wdBinding('P264', `Q20${i}`, l)));
  if (country) bindings.push(wdBinding('P495', 'Q145', country));
  members.forEach((m, i) => bindings.push(wdBinding('P527', `Q30${i}`, m)));
  memberOf.forEach((m, i) => bindings.push(wdBinding('P463', `Q40${i}`, m)));
  return { head: { vars: ['prop', 'value', 'valueLabel'] }, results: { bindings } };
}

function wdMbidResult(qid) {
  return { head: { vars: ['item'] }, results: { bindings: qid ? [{ item: { type: 'uri', value: `http://www.wikidata.org/entity/${qid}` } }] : [] } };
}

module.exports = { lastfmTags, lastfmTrackInfo, lastfmSimilarTracks, lastfmSimilarArtists, lastfmTopTracks, lastfmSearch, mbRecording, mbSearch, mbArtist, wdRelations, wdMbidResult };
