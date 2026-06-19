import { describe, expect, it } from "vitest";
import {
  DEFAULT_METADATA_MODEL,
  DEFAULT_METADATA_TIMEOUT_MS,
  METADATA_TIMEOUT_ERROR_MESSAGE,
  buildMetadataContext,
  callOllamaMetadata,
  checkOllamaMetadataHealth,
  metadataModelFromEnv,
  metadataTimeoutMsFromEnv,
  missingMetadataModelMessage,
  proposeAiMetadata,
  sanitizeMetadataProposal,
  selectRelevantMetadataExamples,
} from "./metadataAi.js";

describe("AI metadata proposal cleanup", () => {
  it("defaults to a small local model while preserving env overrides", () => {
    expect(DEFAULT_METADATA_MODEL).toBe("qwen:1.8b");
    expect(metadataModelFromEnv({})).toBe("qwen:1.8b");
    expect(metadataModelFromEnv({ ILISTEN_METADATA_MODEL: "gemma3:1b" })).toBe("gemma3:1b");
    expect(metadataTimeoutMsFromEnv({})).toBe(DEFAULT_METADATA_TIMEOUT_MS);
    expect(metadataTimeoutMsFromEnv({ ILISTEN_METADATA_TIMEOUT_MS: "12000" })).toBe(12000);
    expect(metadataTimeoutMsFromEnv({ ILISTEN_METADATA_TIMEOUT_MS: "bad" })).toBe(DEFAULT_METADATA_TIMEOUT_MS);
  });

  it("removes YouTube wording, filters legacy playlists, and normalizes confidence", () => {
    const result = sanitizeMetadataProposal({
      title: "Clean Song (Official Video)",
      artist: "Clean Artist - Topic",
      album: "YouTube imports",
      albumArtist: "Clean Artist VEVO",
      year: "Released on 2020-01-02",
      track: "06",
      disc: "1",
      composer: "Composer YouTube",
      playlists: ["Chill", "iPod - Artist"],
      confidence: 88,
      sources: ["ollama", "musicbrainz", "ollama"],
    }, {
      title: "YouTube link 1",
      artist: "Unknown Artist",
      album: "Unknown Album",
      albumArtist: "Unknown Artist",
      track: "1",
      playlists: ["Existing"],
    });

    expect(result.metadata).toMatchObject({
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Unknown Album",
      albumArtist: "Clean Artist",
      year: "2020",
      track: "06",
      disc: "1",
      composer: "Composer",
      playlists: ["Existing"],
    });
    expect(result.confidence).toBe(0.88);
    expect(result.sources).toEqual(["ollama", "musicbrainz"]);
  });

  it("uses safe defaults when AI fields are empty or unusable", () => {
    const result = sanitizeMetadataProposal({}, {
      title: "YouTube link 9",
      artist: "Unknown Artist",
      album: "YouTube imports",
      albumArtist: "Unknown Artist",
      track: "not-a-track",
    });

    expect(result.metadata.title).toBe("Untitled");
    expect(result.metadata.artist).toBe("Unknown Artist");
    expect(result.metadata.album).toBe("Unknown Album");
    expect(result.metadata.albumArtist).toBe("Unknown Artist");
    expect(result.metadata.track).toBe("1");
  });

  it("builds a compact evidence context for small local models", async () => {
    const searchOptions = [];
    const context = await buildMetadataContext({
      title: "Messy Song",
      artist: "Messy Artist",
      album: "Unknown Album",
      albumArtist: "Messy Artist",
      track: "1",
      url: "https://youtube.com/watch?v=compact",
      playlists: ["Current"],
      durationSec: 201,
    }, {
      tools: {
        ytdlp: { ok: true, path: "yt-dlp" },
        ffprobe: { ok: false },
        fpcalc: { ok: false },
      },
      examples: Array.from({ length: 7 }, (_, index) => ({
        source: index % 2 ? "manual_edit" : "ai_approval",
        input: { before: { title: `Old ${index}` } },
        output: { title: `Clean ${index}`, artist: "Artist", album: "Album" },
        createdAt: `2026-06-1${index}T00:00:00.000Z`,
      })),
      search: async (_job, options) => {
        searchOptions.push(options);
        return {
          query: "recording query",
          candidates: Array.from({ length: 5 }, (_, index) => ({
            source: "musicbrainz",
            score: 99 - index,
            id: `mb-${index}`,
            title: `MB Song ${index}`,
            artist: "MB Artist",
            album: "MB Album",
            albumArtist: "MB Artist",
            year: "2020",
            track: String(index + 1),
            disc: "1",
            durationSec: 200,
          })),
        };
      },
      itunes: async () => ({
        query: "itunes query",
        candidates: Array.from({ length: 4 }, (_, index) => ({
          source: "itunes",
          score: 98 - index,
          titleScore: 1,
          durationScore: 1,
          id: `itunes-${index}`,
          title: `Apple Song ${index}`,
          artist: "Apple Artist",
          album: "Apple Album",
          year: "2020",
          genre: "Pop",
          track: String(index + 1),
          disc: "1",
          durationSec: 201,
        })),
      }),
      acoustid: async () => ({
        candidates: Array.from({ length: 4 }, (_, index) => ({
          source: "acoustid",
          score: 90 - index,
          id: `acoustid-${index}`,
          title: `AcoustID Song ${index}`,
          artist: "AcoustID Artist",
          album: "AcoustID Album",
        })),
      }),
      run: async () => ({
        stdout: JSON.stringify({
          title: "Messy Song (Official Video)",
          uploader: "Messy Artist - Topic",
          duration: 201,
          upload_date: "20240102",
          description: "oversized-description".repeat(1000),
          formats: Array.from({ length: 50 }, (_, index) => ({ format_id: String(index) })),
        }),
      }),
    });

    expect(searchOptions[0]).toMatchObject({ limit: 3 });
    expect(context.youtube).toMatchObject({
      title: "Messy Song (Official Video)",
      uploader: "Messy Artist - Topic",
      durationSec: 201,
      uploadDate: "20240102",
    });
    expect(context.youtube.description).toBeUndefined();
    expect(context.youtube.formats).toBeUndefined();
    expect(context.musicBrainzCandidates).toHaveLength(3);
    expect(context.itunesCandidates).toHaveLength(3);
    expect(context.acoustidCandidates).toHaveLength(3);
    expect(context.correctionExamples).toHaveLength(5);
    expect(JSON.stringify(context)).not.toContain("oversized-description");
    expect(JSON.stringify(context).length).toBeLessThan(6000);
  });

  it("selects only relevant manual correction examples for the prompt", () => {
    const examples = [
      { source: "manual_edit", input: { before: { title: "Old unrelated" } }, output: { title: "Other Song", artist: "Other Artist" }, createdAt: "2026-06-18T12:05:00.000Z" },
      { source: "manual_edit", input: { before: { title: "Sofia", artist: "Clairo" } }, output: { title: "Sofia", artist: "Clairo", album: "Immunity" }, createdAt: "2026-06-18T12:01:00.000Z" },
      { source: "ai_approval", input: { evidence: { currentMetadata: { title: "Bags", artist: "Clairo" } } }, output: { title: "Bags", artist: "Clairo", album: "Immunity" }, createdAt: "2026-06-18T12:02:00.000Z" },
      { source: "manual_edit", input: { before: { title: "Newest unrelated" } }, output: { title: "Newest", artist: "Someone Else" }, createdAt: "2026-06-18T12:06:00.000Z" },
    ];

    const selected = selectRelevantMetadataExamples({
      title: "Sofia",
      artist: "Clairo",
      album: "Unknown Album",
    }, examples, 3);

    expect(selected.map((example) => example.output.title)).toEqual(["Sofia"]);
  });

  it("passes only selected relevant examples into the context builder", async () => {
    const seenExamples = [];
    await proposeAiMetadata({
      title: "Sofia",
      artist: "Clairo",
      album: "Unknown Album",
      albumArtist: "Clairo",
      track: "1",
      playlists: [],
    }, {
      examples: [
        { source: "manual_edit", output: { title: "Unrelated New", artist: "Other" }, createdAt: "2026-06-18T12:09:00.000Z" },
        { source: "manual_edit", output: { title: "Sofia", artist: "Clairo", album: "Immunity" }, createdAt: "2026-06-18T12:01:00.000Z" },
        { source: "manual_edit", output: { title: "Bags", artist: "Clairo", album: "Immunity" }, createdAt: "2026-06-18T12:02:00.000Z" },
        { source: "ai_approval", input: { before: { title: "Sofia", artist: "Clairo" } }, output: { title: "Copied Bad", artist: "Wrong" }, createdAt: "2026-06-18T12:10:00.000Z" },
      ],
      contextBuilder: async (_job, { examples }) => {
        seenExamples.push(...examples);
        return {
          musicBrainzCandidates: [],
          acoustidCandidates: [],
        };
      },
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ message: { content: JSON.stringify({
          title: "Sofia",
          artist: "Clairo",
          album: "Immunity",
          albumArtist: "Clairo",
          year: "2019",
          genre: "",
          track: "7",
          disc: "",
          composer: "",
          comment: "",
          playlists: [],
          confidence: 0.8,
          sources: ["ollama"],
        }) } }),
      }),
    });

    expect(seenExamples.map((example) => example.output.title)).toEqual(["Sofia", "Bags"]);
  });

  it("uses strong evidence directly without calling the local model", async () => {
    const proposal = await proposeAiMetadata({
      title: "Messy Song",
      artist: "Messy Artist",
      album: "Unknown Album",
      albumArtist: "Messy Artist",
      track: "1",
      playlists: ["Road Trip"],
    }, {
      contextBuilder: async () => ({
        musicBrainzCandidates: [{
          source: "musicbrainz",
          score: 96,
          title: "Clean Song",
          artist: "Clean Artist",
          album: "Clean Album",
          albumArtist: "Clean Artist",
          year: "2022",
          track: "4",
          disc: "1",
        }],
        acoustidCandidates: [],
      }),
      fetchImpl: async () => {
        throw new Error("Ollama should not be called for strong evidence.");
      },
    });

    expect(proposal.model).toBe("evidence-only");
    expect(proposal.usedFallback).toBe(false);
    expect(proposal.metadata).toMatchObject({
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Clean Album",
      year: "2022",
      track: "4",
      playlists: ["Road Trip"],
    });
    expect(proposal.confidence).toBe(0.96);
    expect(proposal.sources).toEqual(["musicbrainz", "evidence-shortcut"]);
  });

  it("uses Apple catalog title and duration evidence directly when channel artist is weak", async () => {
    const proposal = await proposeAiMetadata({
      title: "Lyrical: Labon Ko",
      artist: "T-Series",
      album: "2020 - Singles",
      albumArtist: "T-Series",
      track: "141",
      durationSec: 335,
      playlists: [],
    }, {
      contextBuilder: async () => ({
        youtube: { title: "Lyrical: Labon Ko | Bhool Bhulaiyaa | Pritam | K.K.", durationSec: 335 },
        youtubeInferredMetadata: { title: "Labon Ko", artist: "T-Series" },
        itunesCandidates: [{
          source: "itunes",
          score: 79,
          titleScore: 1,
          durationScore: 0.88,
          title: "Labon Ko",
          artist: "Pritam & KK",
          album: "Bhool Bhulaiyaa (Original Motion Picture Soundtrack)",
          albumArtist: "Pritam & KK",
          year: "2007",
          genre: "Bollywood",
          track: "2",
          disc: "1",
          durationSec: 341,
        }],
        musicBrainzCandidates: [],
        acoustidCandidates: [],
      }),
      fetchImpl: async () => {
        throw new Error("Ollama should not be called for strong Apple evidence.");
      },
    });

    expect(proposal.model).toBe("evidence-only");
    expect(proposal.metadata).toMatchObject({
      title: "Labon Ko",
      artist: "Pritam & KK",
      album: "Bhool Bhulaiyaa (Original Motion Picture Soundtrack)",
      year: "2007",
      genre: "Bollywood",
      track: "2",
    });
    expect(proposal.confidence).toBe(0.79);
    expect(proposal.sources).toEqual(["itunes", "evidence-shortcut"]);
  });

  it("rejects copied AI metadata when the title is unsupported by supplied evidence", async () => {
    await expect(proposeAiMetadata({
      title: "Aasa Kooda",
      artist: "@SaiAbhyankkar",
      album: "2024 - Singles",
      albumArtist: "@SaiAbhyankkar",
      track: "140",
      playlists: [],
    }, {
      contextBuilder: async () => ({
        youtube: { title: "@SaiAbhyankkar - Aasa Kooda (Music Video)", durationSec: 229 },
        youtubeInferredMetadata: { title: "Aasa Kooda", artist: "@SaiAbhyankkar" },
        musicBrainzCandidates: [],
        itunesCandidates: [],
        acoustidCandidates: [],
      }),
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ message: { content: JSON.stringify({
          title: "Lyrical: Labon Ko",
          artist: "T-Series",
          album: "Unknown Album",
          albumArtist: "T-Series",
          year: "2020",
          genre: "",
          track: "141",
          disc: "",
          composer: "",
          comment: "",
          playlists: ["source:youtube"],
          confidence: 0.96,
          sources: ["ollama"],
        }) } }),
      }),
    })).rejects.toThrow(/does not match the supplied song evidence/);
  });

  it("falls back to ranked metadata candidates when weak evidence and Ollama returns invalid JSON", async () => {
    const proposal = await proposeAiMetadata({
      title: "Messy Song",
      artist: "Messy Artist",
      album: "Unknown Album",
      albumArtist: "Messy Artist",
      track: "1",
      playlists: [],
    }, {
      model: "llama3:latest",
      contextBuilder: async () => ({
        musicBrainzCandidates: [{
          source: "musicbrainz",
          score: 74,
          title: "Clean Song",
          artist: "Clean Artist",
          album: "Clean Album",
          albumArtist: "Clean Artist",
          year: "2022",
          track: "4",
          disc: "1",
        }],
        acoustidCandidates: [],
      }),
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ message: { content: "not json" } }),
      }),
    });

    expect(proposal.usedFallback).toBe(true);
    expect(proposal.model).toBe("llama3:latest");
    expect(proposal.metadata).toMatchObject({
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Clean Album",
      year: "2022",
      track: "4",
    });
    expect(proposal.confidence).toBe(0.74);
    expect(proposal.sources).toEqual(["musicbrainz"]);
  });

  it("returns an actionable timeout message when Ollama aborts", async () => {
    await expect(callOllamaMetadata({}, {
      timeoutMs: 1,
      fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("This operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    })).rejects.toThrow(METADATA_TIMEOUT_ERROR_MESSAGE);
  });

  it("returns an actionable missing-model message when Ollama returns 404", async () => {
    await expect(callOllamaMetadata({}, {
      model: "qwen:1.8b",
      fetchImpl: async () => ({ ok: false, status: 404 }),
    })).rejects.toThrow(missingMetadataModelMessage("qwen:1.8b"));
  });

  it("reports missing local models through health readiness", async () => {
    const health = await checkOllamaMetadataHealth({
      model: "qwen:1.8b",
      fetchImpl: async () => ({ ok: false, status: 404 }),
      timeoutMs: 50,
    });

    expect(health).toMatchObject({
      ok: false,
      model: "qwen:1.8b",
      error: missingMetadataModelMessage("qwen:1.8b"),
      timeoutMs: 50,
    });
    expect(health.elapsedMs).toEqual(expect.any(Number));
  });

  it("surfaces missing-model errors without the generic unavailable wrapper", async () => {
    let error;
    try {
      await proposeAiMetadata({
        title: "Song",
        artist: "Artist",
        album: "Unknown Album",
        albumArtist: "Artist",
        track: "1",
        playlists: [],
      }, {
        model: "qwen:1.8b",
        contextBuilder: async () => ({
          musicBrainzCandidates: [],
          acoustidCandidates: [],
        }),
        fetchImpl: async () => ({ ok: false, status: 404 }),
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(missingMetadataModelMessage("qwen:1.8b"));
  });
});
