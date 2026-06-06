import { describe, expect, it } from "vitest";
import { isYoutubeUrl, splitYoutubeUrls } from "./youtube.js";

describe("YouTube URL validation", () => {
  it("accepts common YouTube watch, short, and youtu.be URLs", () => {
    expect(isYoutubeUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYoutubeUrl("https://music.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYoutubeUrl("https://youtu.be/abc123")).toBe(true);
    expect(isYoutubeUrl("https://www.youtube.com/shorts/abc123")).toBe(true);
  });

  it("rejects non-YouTube URLs", () => {
    const result = splitYoutubeUrls("https://example.com/file.mp3\nhttps://youtube.com/watch?v=ok");

    expect(result.accepted).toEqual(["https://youtube.com/watch?v=ok"]);
    expect(result.rejected).toEqual(["https://example.com/file.mp3"]);
  });
});
