import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  downloadCatalogArtwork,
  selectCatalogArtworkCandidate,
  upgradeItunesArtworkUrl,
} from "./catalogArtwork.js";

let tempDir = null;

function project() {
  tempDir = mkdtempSync(join(tmpdir(), "ilisten-art-"));
  return { artworkDir: join(tempDir, "artwork") };
}

function pngBuffer(width = 1000, height = 1000) {
  const buffer = Buffer.alloc(256);
  buffer[0] = 0x89;
  buffer[1] = 0x50;
  buffer[2] = 0x4e;
  buffer[3] = 0x47;
  buffer[4] = 0x0d;
  buffer[5] = 0x0a;
  buffer[6] = 0x1a;
  buffer[7] = 0x0a;
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function imageResponse(buffer, contentType = "image/png") {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : "" },
    arrayBuffer: async () => buffer,
  };
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("catalog artwork", () => {
  it("upgrades iTunes artwork URLs to larger square art", () => {
    expect(upgradeItunesArtworkUrl("https://is1-ssl.mzstatic.com/image/thumb/Music/aa/bb/source/100x100bb.jpg"))
      .toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/aa/bb/source/1000x1000bb.jpg");
  });

  it("selects matching iTunes artwork before other catalog sources", () => {
    const candidate = selectCatalogArtworkCandidate({
      metadata: { title: "Aasa Kooda", artist: "Sai Abhyankkar", album: "Aasa Kooda - Single" },
      context: {
        itunesCandidates: [{
          source: "itunes",
          score: 76,
          title: "Aasa Kooda",
          artist: "Sai Abhyankkar & Sai Smriti",
          album: "Aasa Kooda - Single",
          artworkUrl: "https://example.test/100x100bb.jpg",
        }],
        musicBrainzCandidates: [{
          source: "musicbrainz",
          score: 99,
          title: "Aasa Kooda",
          artist: "Sai Abhyankkar",
          album: "Aasa Kooda - Single",
          releaseId: "release-1",
        }],
      },
    });

    expect(candidate.source).toBe("itunes");
    expect(candidate.artworkUrl).toBe("https://example.test/1000x1000bb.jpg");
  });

  it("downloads and stores trusted square catalog artwork", async () => {
    const root = project();
    const result = await downloadCatalogArtwork({
      project: root,
      job: { id: "job-1" },
      metadata: { title: "Song", artist: "Artist", album: "Album" },
      context: {
        itunesCandidates: [{
          source: "itunes",
          score: 90,
          title: "Song",
          artist: "Artist",
          album: "Album",
          artworkUrl: "https://example.test/100x100bb.png",
        }],
      },
      fetchImpl: async () => imageResponse(pngBuffer()),
    });

    expect(result.ok).toBe(true);
    expect(result.path).toMatch(/job-1-catalog\.png$/);
    expect(existsSync(result.path)).toBe(true);
    expect(result.dimensions).toEqual({ width: 1000, height: 1000 });
  });

  it("rejects non-image catalog artwork responses", async () => {
    const result = await downloadCatalogArtwork({
      project: project(),
      job: { id: "job-1" },
      metadata: { title: "Song", artist: "Artist", album: "Album" },
      context: {
        itunesCandidates: [{
          source: "itunes",
          score: 90,
          title: "Song",
          artist: "Artist",
          album: "Album",
          artworkUrl: "https://example.test/art.txt",
        }],
      },
      fetchImpl: async () => imageResponse(Buffer.alloc(256), "text/plain"),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not an image/);
  });

  it("rejects 16:9 thumbnail-shaped images", async () => {
    const result = await downloadCatalogArtwork({
      project: project(),
      job: { id: "job-1" },
      metadata: { title: "Song", artist: "Artist", album: "Album" },
      context: {
        itunesCandidates: [{
          source: "itunes",
          score: 90,
          title: "Song",
          artist: "Artist",
          album: "Album",
          artworkUrl: "https://example.test/art.png",
        }],
      },
      fetchImpl: async () => imageResponse(pngBuffer(1280, 720)),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not square/);
  });

  it("returns an actionable error when artwork fetch fails", async () => {
    const result = await downloadCatalogArtwork({
      project: project(),
      job: { id: "job-1" },
      metadata: { title: "Song", artist: "Artist", album: "Album" },
      context: {
        itunesCandidates: [{
          source: "itunes",
          score: 90,
          title: "Song",
          artist: "Artist",
          album: "Album",
          artworkUrl: "https://example.test/art.png",
        }],
      },
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/offline/);
  });
});
