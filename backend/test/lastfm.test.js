const http = require('../lib/http');
const lastfm = require('../lib/lastfm');
const { lastfm: mock, nock } = require('./helpers/upstream');

beforeEach(() => {
  http.resetCache();
  nock.cleanAll();
});

describe('lastfm client', () => {
  test('maps track top tags to name and weight', async () => {
    mock('track.gettoptags', { artist: 'The Cure', track: 'A Forest' }, 'lastfm/track.gettoptags.a-forest.json');
    const result = await lastfm.getTopTags('The Cure', 'A Forest');
    expect(result.status).toBe('ok');
    expect(result.tags[0]).toEqual({ name: 'post-punk', weight: 100 });
    expect(result.tags).toHaveLength(6);
  });

  test('falls back to artist tags when the track has none', async () => {
    mock('track.gettoptags', { artist: 'Joy Division' }, 'lastfm/track.gettoptags.empty.json');
    mock('artist.gettoptags', { artist: 'Joy Division' }, 'lastfm/artist.gettoptags.joy-division.json');
    const result = await lastfm.resolveTags('Joy Division', 'Disorder');
    expect(result.status).toBe('ok');
    expect(result.tagSource).toBe('artist');
    expect(result.fallbackReason).toBe('no-tags');
  });

  test('reports not-found for Last.fm error code 6', async () => {
    mock('track.gettoptags', {}, 'lastfm/error.not-found.json');
    mock('artist.gettoptags', {}, 'lastfm/error.not-found.json');
    const result = await lastfm.resolveTags('Nobody', 'Nothing');
    expect(result.status).toBe('not-found');
    expect(result.tagSource).toBeNull();
  });

  test('track info exposes listeners, corrected names and MBID hints', async () => {
    mock('track.getinfo', { artist: 'the cure' }, 'lastfm/track.getinfo.a-forest.json');
    const info = await lastfm.getTrackInfo('the cure', 'a forest');
    expect(info).toMatchObject({
      status: 'ok',
      listeners: 812345,
      correctedArtist: 'The Cure',
      correctedTitle: 'A Forest',
      artistMbid: '69ee3720-a7cb-4402-b48d-a02c366f2bcf'
    });
  });

  test('similar tracks carry artist, title, match and playcount', async () => {
    mock('track.getsimilar', { artist: 'The Cure' }, 'lastfm/track.getsimilar.a-forest.json');
    const result = await lastfm.getSimilarTracks('The Cure', 'A Forest');
    expect(result.tracks).toHaveLength(3);
    expect(result.tracks[1]).toEqual({ artist: 'Bauhaus', title: "Bela Lugosi's Dead", match: 0.91, playcount: 2210983 });
  });

  test('track search returns artist, title and listeners', async () => {
    mock('track.search', { track: 'forest' }, 'lastfm/track.search.forest.json');
    const result = await lastfm.searchTracks('forest');
    expect(result.results[0]).toEqual({ artist: 'The Cure', title: 'A Forest', listeners: 812345 });
  });

  test('offline mode surfaces offline-miss', async () => {
    process.env.NEXTTRACK_OFFLINE = '1';
    const result = await lastfm.getTopTags('The Cure', 'A Forest');
    delete process.env.NEXTTRACK_OFFLINE;
    expect(result.status).toBe('offline-miss');
  });
});
