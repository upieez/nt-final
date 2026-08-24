const http = require('./http');

// Direct-claim properties fetched for an artist entity, one SPARQL round trip per artist
const PROPERTIES = { P136: 'genres', P264: 'labels', P495: 'country', P527: 'members', P463: 'memberOf' };
const ENTITY_PREFIX = 'http://www.wikidata.org/entity/';
const MUSICBRAINZ_ARTIST_ID = 'P434';

async function sparql(query) {
  const result = await http.request('wikidata', { params: { query, format: 'json' } });
  if (result.status !== 'ok') return { status: result.status, message: result.message, bindings: null };
  if (result.httpStatus >= 400) return { status: 'error', message: `HTTP ${result.httpStatus}`, bindings: null };
  return { status: 'ok', bindings: result.body?.results?.bindings || [] };
}

function entityId(uri) {
  return typeof uri === 'string' && uri.startsWith(ENTITY_PREFIX) ? uri.slice(ENTITY_PREFIX.length) : null;
}

function propertyId(uri) {
  return typeof uri === 'string' ? uri.slice(uri.lastIndexOf('/') + 1) : null;
}

function isValidQid(qid) {
  return /^Q\d+$/.test(qid || '');
}

function relationsQuery(qid) {
  const props = Object.keys(PROPERTIES).map((p) => `wdt:${p}`).join(' ');
  return `SELECT ?prop ?value ?valueLabel WHERE { VALUES ?prop { ${props} } wd:${qid} ?prop ?value . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
}

function emptyRelations(qid) {
  return { qid, genres: [], labels: [], country: null, members: [], memberOf: [] };
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

// Labels without an English translation come back as the bare QID, which is useless for matching
function englishLabel(binding) {
  const label = binding.valueLabel?.value;
  return label && !isValidQid(label) ? label : null;
}

function fold(qid, bindings) {
  const relations = emptyRelations(qid);
  for (const binding of bindings) {
    const field = PROPERTIES[propertyId(binding.prop?.value)];
    const label = englishLabel(binding);
    if (!field || !label) continue;
    if (field === 'country') relations.country = relations.country || label;
    else pushUnique(relations[field], label);
  }
  return relations;
}

// Returns { status, relations } with relations = { qid, genres[], labels[], country, members[], memberOf[] }
async function getArtistRelations(qid) {
  if (!isValidQid(qid)) return { status: 'error', message: `Invalid Wikidata id: ${qid}`, relations: null };
  const { status, message, bindings } = await sparql(relationsQuery(qid));
  if (status !== 'ok') return { status, message, relations: null };
  return { status: 'ok', relations: fold(qid, bindings) };
}

// Fallback when MusicBrainz has no Wikidata url-rel: Wikidata stores the MBID as P434
async function findArtistByMbid(mbid) {
  const query = `SELECT ?item WHERE { ?item wdt:${MUSICBRAINZ_ARTIST_ID} "${String(mbid).replace(/["\\]/g, '')}" } LIMIT 1`;
  const { status, message, bindings } = await sparql(query);
  if (status !== 'ok') return { status, message, qid: null };
  const qid = bindings.length ? entityId(bindings[0].item?.value) : null;
  return { status: qid ? 'ok' : 'not-found', qid };
}

module.exports = { getArtistRelations, findArtistByMbid, relationsQuery };
