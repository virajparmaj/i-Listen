import { describe, expect, it } from "vitest";
import { buildItunesQuery, rankItunesResults, searchItunes } from "./itunes.js";

describe("iTunes metadata lookup", () => {
  it("prefers an explicit rich search query when provided", () => {
    expect(buildItunesQuery({
      title: "Labon Ko",
      artist: "",
      searchQuery: "Lyrical Labon Ko Bhool Bhulaiyaa Pritam K.K.",
    })).toBe("Lyrical Labon Ko Bhool Bhulaiyaa Pritam K.K.");
  });

  it("ranks title and duration matches above unrelated songs", () => {
    const ranked = rankItunesResults([
      {
        trackId: 1,
        trackName: "Taraste Labon Ko Hansi Mil Gayee Hai",
        artistName: "Other Artist",
        collectionName: "Other Album",
        releaseDate: "2020-01-01T00:00:00Z",
        trackNumber: 3,
        discNumber: 1,
        trackTimeMillis: 235000,
      },
      {
        trackId: 2,
        trackName: "Labon Ko",
        artistName: "Pritam & KK",
        collectionName: "Bhool Bhulaiyaa (Original Motion Picture Soundtrack)",
        releaseDate: "2007-09-03T12:00:00Z",
        primaryGenreName: "Bollywood",
        trackNumber: 2,
        discNumber: 1,
        trackTimeMillis: 341028,
      },
    ], { title: "Labon Ko", artist: "", durationSec: 335 });

    expect(ranked[0]).toMatchObject({
      id: "2",
      source: "itunes",
      title: "Labon Ko",
      artist: "Pritam & KK",
      album: "Bhool Bhulaiyaa (Original Motion Picture Soundtrack)",
      year: "2007",
      genre: "Bollywood",
      track: "2",
      disc: "1",
      durationSec: 341,
    });
    expect(ranked[0].titleScore).toBe(1);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("searches iTunes with song entity and ranks the response", async () => {
    const requestedUrls = [];
    const result = await searchItunes({
      title: "Aasa Kooda",
      artist: "",
      durationSec: 229,
      searchQuery: "SaiAbhyankkar Aasa Kooda Thejo Bharathwaj Preity Mukundhan",
      fallbackQueries: ["Aasa Kooda"],
    }, {
      fetchImpl: async (url) => {
        requestedUrls.push(String(url));
        const firstAttempt = requestedUrls.length === 1;
        return {
          ok: true,
          json: async () => ({
            results: firstAttempt ? [] : [{
              trackId: 3,
              trackName: "Aasa Kooda (From \"Think Indie\")",
              artistName: "Sai Abhyankkar & Sai Smriti",
              collectionName: "Aasa Kooda (From \"Think Indie\") - Single",
              releaseDate: "2024-06-13T12:00:00Z",
              trackNumber: 1,
              discNumber: 1,
              trackTimeMillis: 215510,
            }],
          }),
        };
      },
    });

    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toContain("entity=song");
    expect(requestedUrls[0]).toContain("SaiAbhyankkar");
    expect(requestedUrls[1]).toContain("Aasa");
    expect(result.candidates[0]).toMatchObject({
      title: "Aasa Kooda (From \"Think Indie\")",
      artist: "Sai Abhyankkar & Sai Smriti",
      album: "Aasa Kooda (From \"Think Indie\") - Single",
      track: "1",
    });
  });
});
