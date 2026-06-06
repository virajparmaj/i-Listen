import { describe, expect, it } from "vitest";
import { inferTrackMetadata, normalizePlaylists, playlistsToText } from "./metadata.js";

describe("metadata inference", () => {
  it("splits common Artist - Title YouTube titles and creates artist playlists", () => {
    const meta = inferTrackMetadata({
      title: "Cigarettes After Sex - Apocalypse (Official Audio)",
      uploader: "Cigarettes After Sex",
      upload_date: "20170321",
    });

    expect(meta.artist).toBe("Cigarettes After Sex");
    expect(meta.title).toBe("Apocalypse");
    expect(meta.album).toBe("2017 - Singles");
    expect(meta.playlists).toContain("iPod - Cigarettes After Sex");
  });

  it("normalizes manually typed playlist names", () => {
    expect(normalizePlaylists("iPod - Chill, iPod - Night\n iPod - Chill")).toEqual(["iPod - Chill", "iPod - Night"]);
    expect(playlistsToText(["iPod - A", "iPod - B"])).toBe("iPod - A, iPod - B");
  });
});
