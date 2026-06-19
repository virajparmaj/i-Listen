import { describe, expect, it } from "vitest";
import { buildMusicBrainzQuery, rankMusicBrainzRecordings, searchMusicBrainz } from "./musicBrainz.js";

describe("MusicBrainz metadata lookup", () => {
  it("builds a focused recording search query", () => {
    expect(buildMusicBrainzQuery({ title: "Apocalypse", artist: "Cigarettes After Sex" }))
      .toBe('recording:"Apocalypse" AND artist:"Cigarettes After Sex"');
  });

  it("ranks matching recordings above unrelated results", () => {
    const ranked = rankMusicBrainzRecordings([
      {
        id: "wrong",
        title: "Other Song",
        length: 120000,
        "artist-credit": [{ name: "Other Artist" }],
        releases: [{ title: "Other Album", date: "2001-01-01" }],
      },
      {
        id: "right",
        title: "Apocalypse",
        length: 290000,
        "artist-credit": [{ name: "Cigarettes After Sex" }],
        releases: [{
          title: "Cigarettes After Sex",
          date: "2017-06-09",
          "artist-credit": [{ name: "Cigarettes After Sex" }],
          media: [{ position: 1, tracks: [{ number: "4", recording: { id: "right" } }] }],
        }],
      },
    ], { title: "Apocalypse", artist: "Cigarettes After Sex", durationSec: 290 });

    expect(ranked[0]).toMatchObject({
      id: "right",
      title: "Apocalypse",
      artist: "Cigarettes After Sex",
      album: "Cigarettes After Sex",
      year: "2017",
      track: "4",
      disc: "1",
      source: "musicbrainz",
    });
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("preserves MusicBrainz artist-credit join phrases", () => {
    const ranked = rankMusicBrainzRecordings([
      {
        id: "joined",
        title: "Aasa Kooda",
        length: 215510,
        "artist-credit": [
          { name: "Sai Abhyankkar", joinphrase: " & " },
          { name: "Sai Smriti", joinphrase: "" },
        ],
        releases: [{
          title: "Aasa Kooda",
          date: "2024-06-13",
          "artist-credit": [
            { name: "Sai Abhyankkar", joinphrase: " & " },
            { name: "Sai Smriti", joinphrase: "" },
          ],
          media: [{ position: 1, tracks: [{ number: "1", recording: { id: "joined" } }] }],
        }],
      },
    ], { title: "Aasa Kooda", artist: "Sai Abhyankkar", durationSec: 216 });

    expect(ranked[0]).toMatchObject({
      artist: "Sai Abhyankkar & Sai Smriti",
      albumArtist: "Sai Abhyankkar & Sai Smriti",
    });
  });

  it("searches MusicBrainz with JSON headers and ranks the response", async () => {
    let requestedUrl = "";
    let requestedHeaders = {};
    const result = await searchMusicBrainz({ title: "Song", artist: "Artist" }, {
      delayMs: 0,
      fetchImpl: async (url, options) => {
        requestedUrl = String(url);
        requestedHeaders = options.headers;
        return {
          ok: true,
          json: async () => ({
            recordings: [{
              id: "mbid",
              title: "Song",
              "artist-credit": [{ name: "Artist" }],
              releases: [{ title: "Album", date: "2020" }],
            }],
          }),
        };
      },
    });

    expect(requestedUrl).toContain("/recording?");
    expect(requestedUrl).toContain("fmt=json");
    expect(requestedHeaders["User-Agent"]).toContain("iListen");
    expect(result.candidates[0]).toMatchObject({ title: "Song", artist: "Artist", album: "Album" });
  });
});
