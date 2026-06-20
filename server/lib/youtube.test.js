import { describe, expect, it } from "vitest";
import { isYoutubeUrl, normalizeYoutubeUrl, splitYoutubeUrls } from "./youtube.js";

describe("YouTube URL validation", () => {
  it("accepts common YouTube watch, short, and youtu.be URLs", () => {
    expect(isYoutubeUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYoutubeUrl("https://music.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYoutubeUrl("https://youtu.be/abc123")).toBe(true);
    expect(isYoutubeUrl("https://www.youtube.com/shorts/abc123")).toBe(true);
    expect(isYoutubeUrl("KvT4gs8wZxg")).toBe(true);
    expect(normalizeYoutubeUrl("KvT4gs8wZxg")).toBe("https://www.youtube.com/watch?v=KvT4gs8wZxg");
    expect(normalizeYoutubeUrl("https://youtu.be/KvT4gs8wZxg")).toBe("https://www.youtube.com/watch?v=KvT4gs8wZxg");
  });

  it("rejects non-YouTube URLs", () => {
    const result = splitYoutubeUrls("https://example.com/file.mp3\nhttps://youtube.com/watch?v=ok");

    expect(result.accepted).toEqual(["https://youtube.com/watch?v=ok"]);
    expect(result.rejected).toEqual(["https://example.com/file.mp3"]);
  });

  it("normalizes bare video IDs when splitting submitted links", () => {
    const result = splitYoutubeUrls("KvT4gs8wZxg\nhttps://youtube.com/watch?v=dQw4w9WgXcQ");

    expect(result.accepted).toEqual([
      "https://www.youtube.com/watch?v=KvT4gs8wZxg",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ]);
    expect(result.rejected).toEqual([]);
  });
});
