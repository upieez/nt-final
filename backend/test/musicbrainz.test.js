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
});
