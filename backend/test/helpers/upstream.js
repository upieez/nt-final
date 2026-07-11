const fs = require('fs');
const path = require('path');
const nock = require('nock');

const FIXTURES = path.join(__dirname, '..', 'fixtures');

function fixture(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, relativePath), 'utf8'));
}

// Matches a Last.fm call by method plus any subset of query params, case-insensitively
function lastfm(method, match, reply, status = 200) {
  return nock('https://ws.audioscrobbler.com')
    .get('/2.0/')
    .query((q) => q.method === method && Object.keys(match).every((k) => String(q[k]).toLowerCase() === String(match[k]).toLowerCase()))
    .reply(status, typeof reply === 'string' ? fixture(reply) : reply);
}

function musicbrainz(pathPattern, match, reply, status = 200) {
  return nock('https://musicbrainz.org')
    .get(pathPattern)
    .query((q) => Object.keys(match).every((k) => String(q[k]).toLowerCase().includes(String(match[k]).toLowerCase())))
    .reply(status, typeof reply === 'string' ? fixture(reply) : reply);
}

function wikidata(queryFragment, reply, status = 200) {
  return nock('https://query.wikidata.org')
    .get('/sparql')
    .query((q) => String(q.query).includes(queryFragment))
    .reply(status, typeof reply === 'string' ? fixture(reply) : reply);
}

module.exports = { fixture, lastfm, musicbrainz, wikidata, nock };
