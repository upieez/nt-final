const nock = require('nock');
const build = require('./build');
const { normaliseName } = require('../../lib/reconcile');

const NOT_FOUND = { error: 6, message: 'Track not found', links: [] };

// Small self-consistent test world
const ARTISTS = {
  'Joy Division': { mbid: 'mb-jd', country: 'GB', genres: ['post-punk', 'new wave'], wikidataId: 'Q1', labels: ['Factory Records'], members: ['Ian Curtis', 'Peter Hook', 'Bernard Sumner'], tags: [['post-punk', 100], ['new wave', 60], ['80s', 40]], similar: ['New Order', 'Bauhaus'] },
  'The Cure': { mbid: 'mb-cure', country: 'GB', genres: ['post-punk', 'gothic rock', 'new wave'], wikidataId: 'Q2', labels: ['Fiction Records'], members: ['Robert Smith'], tags: [['post-punk', 100], ['gothic rock', 70], ['new wave', 50]], similar: ['Siouxsie and the Banshees', 'Bauhaus'] },
  'New Order': { mbid: 'mb-no', country: 'GB', genres: ['new wave', 'synth-pop'], wikidataId: 'Q3', labels: ['Factory Records'], members: ['Peter Hook', 'Bernard Sumner'], tags: [['new wave', 100], ['synthpop', 80], ['80s', 50]], similar: ['Joy Division'] },
  Bauhaus: { mbid: 'mb-bau', country: 'GB', genres: ['gothic rock', 'post-punk'], wikidataId: 'Q4', labels: ['4AD', 'Beggars Banquet'], members: ['Peter Murphy', 'Daniel Ash'], tags: [['gothic rock', 100], ['post-punk', 90], ['goth', 60]], similar: ['The Cure'] },
  'Siouxsie and the Banshees': { mbid: 'mb-sb', country: 'GB', genres: ['post-punk', 'gothic rock'], wikidataId: 'Q5', labels: ['Polydor Records'], members: ['Siouxsie Sioux', 'Steven Severin'], tags: [['post-punk', 100], ['gothic rock', 60], ['female vocalists', 40]], similar: ['The Cure'] },
  'Echo & the Bunnymen': { mbid: 'mb-echo', country: 'GB', genres: ['post-punk', 'neo-psychedelia'], wikidataId: 'Q6', labels: ['Korova'], members: ['Ian McCulloch'], tags: [['post-punk', 100], ['new wave', 70], ['80s', 60]], similar: ['The Cure'] },
  'Carly Rae Jepsen': { mbid: 'mb-crj', country: 'CA', genres: ['pop', 'synth-pop'], wikidataId: 'Q7', labels: ['Interscope Records'], members: [], tags: [['pop', 100], ['synthpop', 60], ['dance', 40]], similar: [] },
  'Peter Hook and the Light': { mbid: 'mb-hook', country: 'GB', genres: ['post-punk'], wikidataId: 'Q8', labels: [], members: ['Peter Hook'], tags: [['post-punk', 100], ['live', 40]], similar: ['New Order'] },
  Nas: { mbid: 'mb-nas', country: 'US', genres: ['hip hop', 'east coast hip hop'], wikidataId: 'Q9', labels: ['Columbia Records'], members: [], tags: [['hip-hop', 100], ['rap', 80], ['90s', 40]], similar: [] },
  'Miles Davis': { mbid: 'mb-miles', country: 'US', genres: ['jazz', 'cool jazz'], wikidataId: 'Q10', labels: ['Columbia Records'], members: [], tags: [['jazz', 100], ['trumpet', 50]], similar: [] },
  'Clan of Xymox': { mbid: 'mb-cox', country: 'NL', genres: ['darkwave', 'gothic rock'], wikidataId: null, labels: ['4AD'], members: ['Ronny Moorings'], tags: [['darkwave', 100], ['gothic rock', 80]], similar: ['Bauhaus'] }
};

const TRACKS = {
  'Joy Division|Disorder': { mbid: 'rec-disorder', listeners: 900000, isrcs: ['GBAAA7900001'], tags: [] },
  'The Cure|A Forest': { mbid: 'rec-forest', listeners: 812345, isrcs: ['GBAAA8000123'], tags: [['post-punk', 100], ['gothic rock', 80], ['new wave', 40], ['80s', 30]] },
  'New Order|Ceremony': { mbid: 'rec-ceremony', listeners: 700000, tags: [['post-punk', 100], ['new wave', 90], ['80s', 40]] },
  'New Order|Blue Monday': { mbid: 'rec-bluemonday', listeners: 1900000, tags: [['synthpop', 100], ['new wave', 90], ['dance', 60], ['80s', 50]] },
  "Bauhaus|Bela Lugosi's Dead": { mbid: 'rec-bela', listeners: 600000, tags: [['gothic rock', 100], ['post-punk', 80], ['goth', 70]] },
  'Bauhaus|She\'s in Parties': { mbid: 'rec-parties', listeners: 250000, tags: [['gothic rock', 100], ['post-punk', 60]] },
  'Siouxsie and the Banshees|Spellbound': { mbid: 'rec-spellbound', listeners: 650000, tags: [['post-punk', 100], ['gothic rock', 70], ['new wave', 50], ['80s', 40]] },
  'Siouxsie and the Banshees|Cities in Dust': { mbid: 'rec-cities', listeners: 500000, tags: [['post-punk', 100], ['new wave', 60]] },
  'Echo & the Bunnymen|The Killing Moon': { mbid: 'rec-killingmoon', listeners: 1100000, tags: [['post-punk', 100], ['new wave', 80], ['80s', 70]] },
  'Carly Rae Jepsen|Call Me Maybe': { mbid: 'rec-cmm', listeners: 2380904, tags: [['pop', 100], ['dance', 60], ['2012', 30]] },
  'Peter Hook and the Light|Atmosphere': { mbid: 'rec-atmos', listeners: 20000, tags: [] },
  'Nas|N.Y. State of Mind': { mbid: 'rec-nystate', listeners: 950000, tags: [['hip-hop', 100], ['rap', 90], ['east coast', 60]] },
  'Miles Davis|So What': { mbid: 'rec-sowhat', listeners: 880000, tags: [['jazz', 100], ['cool jazz', 70], ['instrumental', 40]] },
  'Clan of Xymox|Stranger': { mbid: 'rec-stranger', listeners: 40000, tags: [['darkwave', 100], ['gothic rock', 70]] }
};

const SIMILAR_TRACKS = {
  'The Cure|A Forest': [['Siouxsie and the Banshees', 'Spellbound', 0.95], ["Bauhaus", "Bela Lugosi's Dead", 0.9], ['Echo & the Bunnymen', 'The Killing Moon', 0.85], ['New Order', 'Ceremony', 0.8], ['Carly Rae Jepsen', 'Call Me Maybe', 0.2]],
  'Joy Division|Disorder': [['New Order', 'Ceremony', 0.97], ['The Cure', 'A Forest', 0.9], ['Peter Hook and the Light', 'Atmosphere', 0.5], ['Clan of Xymox', 'Stranger', 0.4]]
};

const TAG_TOP_TRACKS = {
  'hip-hop': [['Nas', 'N.Y. State of Mind']],
  electronic: [],
  jazz: [['Miles Davis', 'So What']]
};

function trackKeyOf(artist, title) {
  return `${normaliseName(artist)}|${normaliseName(title)}`;
}

function findTrack(artist, title) {
  const key = trackKeyOf(artist, title);
  const name = Object.keys(TRACKS).find((k) => trackKeyOf(...k.split('|')) === key);
  return name ? { name, artist: name.split('|')[0], title: name.split('|')[1], ...TRACKS[name] } : null;
}

function findArtist(name) {
  const found = Object.keys(ARTISTS).find((a) => normaliseName(a) === normaliseName(name));
  return found ? { name: found, ...ARTISTS[found] } : null;
}

function topTracksOf(artistName) {
  return Object.keys(TRACKS).filter((k) => k.startsWith(`${artistName}|`)).map((k) => [k.split('|')[1], TRACKS[k].listeners]);
}

function lastfmReply(q, overrides) {
  if (overrides[q.method]) return overrides[q.method];
  const artist = findArtist(q.artist);
  const track = q.track ? findTrack(q.artist, q.track) : null;
  switch (q.method) {
    case 'track.getinfo': return track ? build.lastfmTrackInfo({ artist: track.artist, title: track.title, listeners: track.listeners, artistMbid: artist ? artist.mbid : '' }) : NOT_FOUND;
    case 'track.gettoptags': return track ? build.lastfmTags(track.tags) : NOT_FOUND;
    case 'artist.gettoptags': return artist ? build.lastfmTags(artist.tags) : NOT_FOUND;
    case 'track.getsimilar': return track ? build.lastfmSimilarTracks((SIMILAR_TRACKS[track.name] || []).map(([a, t, m]) => [a, t, m, 1000])) : NOT_FOUND;
    case 'artist.getsimilar': return artist ? build.lastfmSimilarArtists(artist.similar.map((s) => [s, 0.8])) : NOT_FOUND;
    case 'artist.gettoptracks': return artist ? build.lastfmTopTracks(artist.name, topTracksOf(artist.name)) : NOT_FOUND;
    case 'tag.gettoptracks': return build.lastfmTagTopTracks(q.tag, TAG_TOP_TRACKS[q.tag] || []);
    case 'track.search': return build.lastfmSearch(Object.keys(TRACKS).filter((k) => normaliseName(k).includes(normaliseName(q.track))).map((k) => [k.split('|')[0], k.split('|')[1], TRACKS[k].listeners]));
    default: return NOT_FOUND;
  }
}

function parseLucene(query) {
  const match = /artist:"([^"]*)" AND recording:"([^"]*)"/.exec(query || '');
  return match ? { artist: match[1], title: match[2] } : { artist: '', title: '' };
}

function mbSearchReply(q) {
  const { artist, title } = parseLucene(q.query);
  const track = findTrack(artist, title);
  const owner = track ? findArtist(track.artist) : null;
  if (!track || !owner) return build.mbSearch([]);
  return build.mbSearch([{ id: track.mbid, title: track.title, artist: owner.name, artistId: owner.mbid, score: 100, isrcs: track.isrcs || [] }]);
}

function mbRecordingReply(mbid) {
  const name = Object.keys(TRACKS).find((k) => TRACKS[k].mbid === mbid);
  if (!name) return null;
  const owner = findArtist(name.split('|')[0]);
  return build.mbRecording({ id: mbid, title: name.split('|')[1], artist: owner.name, artistId: owner.mbid, isrcs: TRACKS[name].isrcs || [], genres: [] });
}

function mbArtistReply(mbid) {
  const name = Object.keys(ARTISTS).find((a) => ARTISTS[a].mbid === mbid);
  return name ? build.mbArtist({ id: mbid, name, country: ARTISTS[name].country, genres: ARTISTS[name].genres, wikidataId: ARTISTS[name].wikidataId }) : null;
}

function wikidataReply(query) {
  const byQid = /wd:(Q\d+)/.exec(query);
  if (byQid) {
    const name = Object.keys(ARTISTS).find((a) => ARTISTS[a].wikidataId === byQid[1]);
    return name ? build.wdRelations({ genres: ARTISTS[name].genres, labels: ARTISTS[name].labels, members: ARTISTS[name].members }) : build.wdRelations({});
  }
  return build.wdMbidResult(null);
}

// Installs world interceptors
function install(overrides = {}) {
  nock('https://ws.audioscrobbler.com').persist().get('/2.0/').query(true).reply((uri) => [200, lastfmReply(Object.fromEntries(new URL(uri, 'https://x').searchParams), overrides)]);
  nock('https://musicbrainz.org').persist().get('/ws/2/recording').query(true).reply((uri) => [200, mbSearchReply(Object.fromEntries(new URL(uri, 'https://x').searchParams))]);
  nock('https://musicbrainz.org').persist().get(/\/ws\/2\/recording\/.+/).query(true).reply((uri) => {
    const body = mbRecordingReply(decodeURIComponent(uri.split('?')[0].split('/').pop()));
    return body ? [200, body] : [404, { error: 'Not Found' }];
  });
  nock('https://musicbrainz.org').persist().get(/\/ws\/2\/artist\/.+/).query(true).reply((uri) => {
    const body = mbArtistReply(decodeURIComponent(uri.split('?')[0].split('/').pop()));
    return body ? [200, body] : [404, { error: 'Not Found' }];
  });
  nock('https://query.wikidata.org').persist().get('/sparql').query(true).reply((uri) => [200, wikidataReply(new URL(uri, 'https://x').searchParams.get('query'))]);
}

module.exports = { install, ARTISTS, TRACKS, NOT_FOUND };
