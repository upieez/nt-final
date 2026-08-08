const http = require('../lib/http');
const { resolveTrack, resolveArtist, matchRate } = require('../lib/reconcile');
const { lastfm, musicbrainz, wikidata, nock, fixture } = require('./helpers/upstream');
const build = require('./helpers/build');

const NOT_FOUND = fixture('lastfm/error.not-found.json');

beforeEach(() => {
  http.resetCache();
  nock.cleanAll();
});

describe('resolveTrack', () => {
  test('exact name match uses the MusicBrainz search score as confidence and completes the recording for seeds', async () => {
    lastfm('track.getinfo', { artist: 'The Cure' }, 'lastfm/track.getinfo.a-forest.json');
    musicbrainz('/ws/2/recording', { query: 'a forest' }, 'musicbrainz/recording.search.a-forest.json');
    musicbrainz('/ws/2/recording/3f0e5b2a-6a51-4a4e-9d3c-0d2f7b1f4c88', {}, 'musicbrainz/recording.lookup.a-forest.json');
    const result = await resolveTrack({ artist: 'The Cure', title: 'A Forest' }, { full: true });
    expect(result).toMatchObject({
      artist: 'The Cure',
      title: 'A Forest',
      mbid: '3f0e5b2a-6a51-4a4e-9d3c-0d2f7b1f4c88',
      artistMbid: '69ee3720-a7cb-4402-b48d-a02c366f2bcf',
      isrc: ['GBAAA8000123', 'GBAAA0500456'],
      matchedBy: 'exact',
      matchConfidence: 1,
      listeners: 812345,
      recordingGenres: ['post-punk', 'gothic rock'],
      failures: []
    });
  });

  test('Run the Jewels title with different bracket casing matches after normalisation', async () => {
    lastfm('track.getinfo', {}, NOT_FOUND);
    musicbrainz('/ws/2/recording', { query: 'run the jewels' }, build.mbSearch([
      { id: 'rtj-1', title: 'Close Your Eyes (and Count to Fuck)', artist: 'Run the Jewels', artistId: 'rtj-artist', score: 100, isrcs: ['USMS31500011'] }
    ]));
    const result = await resolveTrack({ artist: 'Run the Jewels', title: 'Close Your Eyes (And Count to Fuck)' });
    expect(result).toMatchObject({ mbid: 'rtj-1', matchedBy: 'exact', matchConfidence: 1 });
  });

  test('Last.fm autocorrect supplies the accented name that MusicBrainz expects', async () => {
    lastfm('track.getinfo', { artist: 'Sigur Ros' }, build.lastfmTrackInfo({ artist: 'Sigur Rós', title: 'Hoppípolla', listeners: 500000 }));
    const scope = musicbrainz('/ws/2/recording', { query: 'artist:"sigur rós"' }, build.mbSearch([
      { id: 'sr-1', title: 'Hoppípolla', artist: 'Sigur Rós', artistId: 'sr-artist', score: 100 }
    ]));
    const result = await resolveTrack({ artist: 'Sigur Ros', title: 'Hoppipolla' });
    expect(scope.isDone()).toBe(true);
    expect(result).toMatchObject({ artist: 'Sigur Rós', title: 'Hoppípolla', matchedBy: 'exact', mbid: 'sr-1' });
  });

  test('featured artist suffix is ignored so the credited artist still matches', async () => {
    lastfm('track.getinfo', {}, NOT_FOUND);
    musicbrainz('/ws/2/recording', { query: 'crazy in love' }, build.mbSearch([
      { id: 'bey-1', title: 'Crazy in Love', artist: 'Beyoncé', artistId: 'bey-artist', score: 98 }
    ]));
    const result = await resolveTrack({ artist: 'Beyoncé feat. Jay-Z', title: 'Crazy in Love' });
    expect(result).toMatchObject({ mbid: 'bey-1', matchedBy: 'normalised', matchConfidence: 0.882 });
  });

  test('live suffix in the input matches the studio recording at normalised confidence', async () => {
    lastfm('track.getinfo', {}, NOT_FOUND);
    musicbrainz('/ws/2/recording', { query: 'bela lugosi' }, build.mbSearch([
      { id: 'bau-live', title: "Bela Lugosi's Dead (live at the Hammersmith)", artist: 'Bauhaus', artistId: 'bau-artist', score: 100 },
      { id: 'bau-1', title: "Bela Lugosi's Dead", artist: 'Bauhaus', artistId: 'bau-artist', score: 97 }
    ]));
    const result = await resolveTrack({ artist: 'Bauhaus', title: "Bela Lugosi's Dead (Live)" });
    expect(result.matchedBy).toBe('normalised');
    expect(result.mbid).toBe('bau-live');
    expect(result.matchConfidence).toBe(0.9);
  });

  test('ISRC cross-check rescues a title spelt differently in the two sources', async () => {
    lastfm('track.getinfo', { artist: 'Nas' }, build.lastfmTrackInfo({ artist: 'Nas', title: 'NY State of Mind', listeners: 900000, mbid: 'nas-lastfm-hint' }));
    musicbrainz('/ws/2/recording', { query: 'state of mind' }, build.mbSearch([
      { id: 'nas-1', title: 'N.Y. State of Mind', artist: 'Nas', artistId: 'nas-artist', score: 95, isrcs: ['USSM19400123'] }
    ]));
    musicbrainz('/ws/2/recording/nas-lastfm-hint', {}, build.mbRecording({ id: 'nas-lastfm-hint', title: 'N.Y. State of Mind', artist: 'Nas', artistId: 'nas-artist', isrcs: ['USSM19400123'] }));
    const result = await resolveTrack({ artist: 'Nas', title: 'NY State of Mind' });
    expect(result).toMatchObject({ mbid: 'nas-1', matchedBy: 'isrc', matchConfidence: 0.76, isrc: ['USSM19400123'] });
  });

  test('an input ISRC resolves directly through the isrc endpoint', async () => {
    lastfm('track.getinfo', {}, NOT_FOUND);
    musicbrainz('/ws/2/isrc/GBAAA8000123', {}, { isrc: 'GBAAA8000123', recordings: [build.mbRecording({ id: 'cure-1', title: 'A Forest', artist: 'The Cure', artistId: 'cure-artist' })] });
    const result = await resolveTrack({ artist: 'Cure', title: 'Forest', isrc: 'GBAAA8000123' });
    expect(result).toMatchObject({ mbid: 'cure-1', matchedBy: 'isrc', matchConfidence: 0.8 });
  });

  test('no hit anywhere yields matchedBy none and keeps the Last.fm artist MBID hint', async () => {
    lastfm('track.getinfo', {}, build.lastfmTrackInfo({ artist: 'Greg Mendez', title: 'Freak', listeners: 3000, artistMbid: 'gm-artist' }));
    musicbrainz('/ws/2/recording', {}, 'musicbrainz/recording.search.empty.json');
    const result = await resolveTrack({ artist: 'Greg Mendez', title: 'Freak' });
    expect(result).toMatchObject({ mbid: null, artistMbid: 'gm-artist', matchedBy: 'none', matchConfidence: 0, listeners: 3000 });
  });

  test('upstream timeouts are recorded as failures without throwing', async () => {
    nock('https://ws.audioscrobbler.com').get('/2.0/').query(true).replyWithError({ code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' });
    nock('https://musicbrainz.org').get(/.*/).query(true).reply(503, {});
    const result = await resolveTrack({ artist: 'Anyone', title: 'Anything' });
    expect(result.matchedBy).toBe('none');
    expect(result.failures).toEqual([{ source: 'lastfm', status: 'timeout' }, { source: 'musicbrainz', status: 'error' }]);
  });

  test('match rate is counted per request', async () => {
    lastfm('track.getinfo', {}, NOT_FOUND).persist();
    musicbrainz('/ws/2/recording', { query: 'a forest' }, 'musicbrainz/recording.search.a-forest.json');
    musicbrainz('/ws/2/recording', { query: 'nothing' }, 'musicbrainz/recording.search.empty.json');
    const { stats } = await http.withRequestStats(async () => {
      await resolveTrack({ artist: 'The Cure', title: 'A Forest' });
      await resolveTrack({ artist: 'Nobody', title: 'Nothing' });
    });
    expect(stats).toMatchObject({ matchAttempted: 2, matchResolved: 1 });
    expect(matchRate(stats)).toBe(0.5);
    expect(matchRate({ matchAttempted: 0, matchResolved: 0 })).toBeNull();
  });
});

describe('resolveArtist', () => {
  test('merges MusicBrainz genres and country with Wikidata labels, members and extra genres', async () => {
    musicbrainz('/ws/2/artist/69ee3720-a7cb-4402-b48d-a02c366f2bcf', {}, 'musicbrainz/artist.lookup.the-cure.json');
    wikidata('wd:Q152459', 'wikidata/relations.the-cure.json');
    const entity = await resolveArtist('69ee3720-a7cb-4402-b48d-a02c366f2bcf');
    expect(entity).toEqual({
      mbid: '69ee3720-a7cb-4402-b48d-a02c366f2bcf',
      name: 'The Cure',
      country: 'GB',
      genres: ['post-punk', 'gothic rock', 'new wave', 'alternative rock'],
      wikidataId: 'Q152459',
      labels: ['Fiction Records', 'Polydor Records'],
      members: ['Robert Smith', 'Simon Gallup', 'Lol Tolhurst'],
      memberOf: [],
      failures: []
    });
  });

  test('falls back to the P434 lookup when MusicBrainz has no Wikidata relation', async () => {
    musicbrainz('/ws/2/artist/c0c9e8d7-1f2a-4b3c-9d4e-5f6a7b8c9d0e', {}, 'musicbrainz/artist.lookup.no-wikidata.json');
    wikidata('wdt:P434 "c0c9e8d7-1f2a-4b3c-9d4e-5f6a7b8c9d0e"', build.wdMbidResult('Q777'));
    wikidata('wd:Q777', build.wdRelations({ genres: ['indie folk'], labels: ['Dear Life Records'], country: 'United States' }));
    const entity = await resolveArtist('c0c9e8d7-1f2a-4b3c-9d4e-5f6a7b8c9d0e');
    expect(entity).toMatchObject({ wikidataId: 'Q777', genres: ['indie folk'], labels: ['Dear Life Records'], country: 'US' });
  });

  test('returns an empty entity when there is no artist MBID', async () => {
    const entity = await resolveArtist(null);
    expect(entity.genres).toEqual([]);
    expect(entity.wikidataId).toBeNull();
  });
});
