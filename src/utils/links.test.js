import { describe, it, expect } from "vitest";
import { extractYouTubeLinks, isYouTubeUrl, mergeLinks, linkLabel } from "./links.js";

describe("extractYouTubeLinks", () => {
  it("pulls links out of multi-line pasted text", () => {
    const text = `https://youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/9bZkp7q19f0`;
    expect(extractYouTubeLinks(text)).toEqual([
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/9bZkp7q19f0",
    ]);
  });

  it("splits comma- and space-separated links", () => {
    const text = "youtu.be/9bZkp7q19f0, https://www.youtube.com/watch?v=dQw4w9WgXcQ kogVZx7Eqck";
    expect(extractYouTubeLinks(text)).toEqual([
      "https://youtu.be/9bZkp7q19f0",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ]);
  });

  it("adds a scheme to protocol-less links", () => {
    expect(extractYouTubeLinks("youtu.be/9bZkp7q19f0")).toEqual([
      "https://youtu.be/9bZkp7q19f0",
    ]);
  });

  it("de-duplicates repeated links", () => {
    const text = "https://youtu.be/9bZkp7q19f0\nhttps://youtu.be/9bZkp7q19f0";
    expect(extractYouTubeLinks(text)).toEqual(["https://youtu.be/9bZkp7q19f0"]);
  });

  it("strips trailing punctuation", () => {
    expect(extractYouTubeLinks("(https://youtu.be/9bZkp7q19f0).")).toEqual([
      "https://youtu.be/9bZkp7q19f0",
    ]);
  });

  it("ignores non-YouTube text and links", () => {
    expect(extractYouTubeLinks("hello https://example.com/song just text")).toEqual([]);
  });

  it("matches shorts and music URLs", () => {
    const text = "https://youtube.com/shorts/abcd1234efg https://music.youtube.com/watch?v=dQw4w9WgXcQ";
    expect(extractYouTubeLinks(text)).toEqual([
      "https://youtube.com/shorts/abcd1234efg",
      "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    ]);
  });
});

describe("isYouTubeUrl", () => {
  it("accepts a single YouTube link", () => {
    expect(isYouTubeUrl("https://youtu.be/9bZkp7q19f0")).toBe(true);
    expect(isYouTubeUrl("youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects blanks, whitespace, and non-YouTube text", () => {
    expect(isYouTubeUrl("")).toBe(false);
    expect(isYouTubeUrl("two links here")).toBe(false);
    expect(isYouTubeUrl("https://example.com")).toBe(false);
  });
});

describe("mergeLinks", () => {
  it("appends only new links, preserving order", () => {
    expect(mergeLinks(["a", "b"], ["b", "c", "a", "d"])).toEqual(["a", "b", "c", "d"]);
  });
});

describe("linkLabel", () => {
  it("shows the video id for watch and youtu.be links", () => {
    expect(linkLabel("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(linkLabel("https://youtu.be/9bZkp7q19f0")).toBe("9bZkp7q19f0");
  });
});
