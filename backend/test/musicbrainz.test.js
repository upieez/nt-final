const http = require('../lib/http');
const mb = require('../lib/musicbrainz');
const { musicbrainz: mock, nock } = require('./helpers/upstream');

beforeEach(() => {
  http.resetCache();
  nock.cleanAll();
});

describe('musicbrainz client', () => {
  test('recording search builds a quoted Lucene query and maps score, artist and ISRCs', async () => {
    const scope = mock('/ws/2/recording', { query: 'artist:"the cure" and recording:"a forest"', fmt: 'json' }, 'musicbrainz/recording.search.a-forest.json');
    const result = await mb.searchRecording('The Cure', 'A Forest');
    expect(scope.isDone()).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.recordings[0]).toMatchObject({
      mbid: '3f0e5b2a-6a51-4a4e-9d3c-0d2f7b1f4c88',
      title: 'A Forest',
      score: 100,
      artistName: 'The Cure',
      artistMbid: '69ee3720-a7cb-4402-b48d-a02c366f2bcf',
      isrcs: ['GBAAA8000123']
    });
    expect(result.recordings[1].score).toBe(88);
  });

  test('quotes and backslashes inside names cannot break the Lucene query', () => {
    expect(mb.luceneQuote('Say "Hello" \\ Wave')).toBe('"Say  Hello    Wave"');
  });

  test('empty search returns an empty list rather than an error', async () => {
    mock('/ws/2/recording', {}, 'musicbrainz/recording.search.empty.json');
    const result = await mb.searchRecording('Nobody', 'Nothing');
    expect(result).toEqual({ recordings: [], status: 'ok' });
  });

  test('recording lookup requests artist credits, ISRCs, genres and tags', async () => {
    const scope = mock('/ws/2/recording/3f0e5b2a-6a51-4a4e-9d3c-0d2f7b1f4c88', { inc: 'artist-credits+isrcs+genres+tags' }, 'musicbrainz/recording.lookup.a-forest.json');
    const result = await mb.getRecording('3f0e5b2a-6a51-4a4e-9d3c-0d2f7b1f4c88');
    expect(scope.isDone()).toBe(true);
    expect(result.recording.isrcs).toEqual(['GBAAA8000123', 'GBAAA0500456']);
    expect(result.recording.genres.map((g) => g.name)).toEqual(['post-punk', 'gothic rock']);
    expect(result.recording.artistMbid).toBe('69ee3720-a7cb-4402-b48d-a02c366f2bcf');
  });

  test('artist lookup extracts genres, country and the Wikidata QID from url-rels', async () => {
    const scope = mock('/ws/2/artist/69ee3720-a7cb-4402-b48d-a02c366f2bcf', { inc: 'genres+tags+url-rels' }, 'musicbrainz/artist.lookup.the-cure.json');
    const result = await mb.getArtist('69ee3720-a7cb-4402-b48d-a02c366f2bcf');
    expect(scope.isDone()).toBe(true);
    expect(result.artist).toMatchObject({ name: 'The Cure', country: 'GB', type: 'Group', wikidataId: 'Q152459' });
    expect(result.artist.genres[0]).toEqual({ name: 'post-punk', count: 14 });
  });

  test('artist without a Wikidata relation yields wikidataId null', async () => {
    mock('/ws/2/artist/c0c9e8d7-1f2a-4b3c-9d4e-5f6a7b8c9d0e', {}, 'musicbrainz/artist.lookup.no-wikidata.json');
    const result = await mb.getArtist('c0c9e8d7-1f2a-4b3c-9d4e-5f6a7b8c9d0e');
    expect(result.artist.wikidataId).toBeNull();
    expect(result.artist.genres).toEqual([]);
  });

  test('a 404 lookup reports not-found', async () => {
    mock('/ws/2/artist/missing', {}, 'musicbrainz/error.not-found.json', 404);
    const result = await mb.getArtist('missing');
    expect(result.status).toBe('not-found');
  });

  test('a 503 reports error', async () => {
    mock('/ws/2/artist/busy', {}, { error: 'Service unavailable' }, 503);
    const result = await mb.getArtist('busy');
    expect(result.status).toBe('error');
  });
});
