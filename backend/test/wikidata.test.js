const http = require('../lib/http');
const wikidata = require('../lib/wikidata');
const { wikidata: mock, nock } = require('./helpers/upstream');

beforeEach(() => {
  http.resetCache();
  nock.cleanAll();
});

describe('wikidata client', () => {
  test('relations query asks for the five direct properties with English labels', () => {
    const query = wikidata.relationsQuery('Q152459');
    expect(query).toContain('wd:Q152459');
    expect(query).toContain('wdt:P136 wdt:P264 wdt:P495 wdt:P527 wdt:P463');
    expect(query).toContain('wikibase:language "en"');
  });

  test('folds bindings into normalised relations, de-duplicated, dropping unlabelled items', async () => {
    const scope = mock('wd:Q152459', 'wikidata/relations.the-cure.json');
    const result = await wikidata.getArtistRelations('Q152459');
    expect(scope.isDone()).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.relations).toEqual({
      qid: 'Q152459',
      genres: ['post-punk', 'gothic rock'],
      labels: ['Fiction Records', 'Polydor Records'],
      country: 'United Kingdom',
      members: ['Robert Smith', 'Simon Gallup', 'Lol Tolhurst'],
      memberOf: []
    });
  });

  test('an entity with no claims yields empty relations', async () => {
    mock('wd:Q1', 'wikidata/relations.empty.json');
    const result = await wikidata.getArtistRelations('Q1');
    expect(result.relations).toEqual({ qid: 'Q1', genres: [], labels: [], country: null, members: [], memberOf: [] });
  });

  test('rejects malformed ids before touching the network', async () => {
    const result = await wikidata.getArtistRelations('not-a-qid');
    expect(result.status).toBe('error');
  });

  test('a query service 5xx is reported as error', async () => {
    mock('wd:Q152459', { message: 'overloaded' }, 503);
    const result = await wikidata.getArtistRelations('Q152459');
    expect(result.status).toBe('error');
  });
});
