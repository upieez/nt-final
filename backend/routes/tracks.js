const express = require("express");
const lastfm = require("../lib/lastfm");
const youtube = require("../lib/youtube");
const { validationError, upstreamError } = require("../lib/errors");

const router = express.Router();
const MAX_RESULTS = 8;

router.get("/search", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) throw validationError(["q must be a non-empty string"]);
    const result = await lastfm.searchTracks(q, MAX_RESULTS);
    if (result.status === "timeout" || result.status === "error")
      throw upstreamError({ source: "lastfm", status: result.status });
    res.json({ results: (result.results || []).slice(0, MAX_RESULTS) });
  } catch (err) {
    next(err);
  }
});

router.get("/info", async (req, res, next) => {
  try {
    const artist =
      typeof req.query.artist === "string" ? req.query.artist.trim() : "";
    const title =
      typeof req.query.title === "string" ? req.query.title.trim() : "";
    const details = [];
    if (!artist) details.push("artist must be a non-empty string");
    if (!title) details.push("title must be a non-empty string");
    if (details.length) throw validationError(details);
    const info = await lastfm.getTrackInfo(artist, title);
    if (info.status === "timeout" || info.status === "error")
      throw upstreamError({ source: "lastfm", status: info.status });
    if (info.status !== "ok")
      return res.json({
        artist,
        title,
        found: false,
        image: null,
        album: null,
        listeners: null,
      });
    res.json({
      artist: info.correctedArtist,
      title: info.correctedTitle,
      found: true,
      image: info.image,
      album: info.album,
      listeners: info.listeners,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/video", async (req, res, next) => {
  try {
    const artist =
      typeof req.query.artist === "string" ? req.query.artist.trim() : "";
    const title =
      typeof req.query.title === "string" ? req.query.title.trim() : "";
    const details = [];
    if (!artist) details.push("artist must be a non-empty string");
    if (!title) details.push("title must be a non-empty string");
    if (details.length) throw validationError(details);
    const track = { artist, title };
    const result = await youtube.findVideo(track);
    res.json({ videoId: result.videoId, searchUrl: youtube.searchUrl(track) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
