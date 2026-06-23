import { describe, expect, it } from "vitest";
import { applyOutputFields, outputFor, presetFor } from "./mockData.js";

const baseTrack = {
  id: "t1",
  title: "Song",
  durationSec: 240,
};

describe("output metadata", () => {
  it("maps required presets to compatible outputs", () => {
    expect(outputFor(presetFor("best").outputOption).encoder).toContain("Copy AAC");
    expect(outputFor(presetFor("ipodSafe").outputOption).encoder).toContain("headroom");
    expect(outputFor(presetFor("mp3").outputOption).encoder).toBe("libmp3lame -q:a 0");
    expect(outputFor(presetFor("apple").outputOption).ext).toBe("m4a");
    expect(outputFor(presetFor("alac").outputOption).format).toBe("alac");
  });

  it("applies output fields and estimated sizes", () => {
    const aac = applyOutputFields(baseTrack, "aac-256");
    expect(aac.ext).toBe("m4a");
    expect(aac.qualityLabel).toBe("AAC 256");
    expect(aac.size).toBe("7.5 MB");
  });

  it("does not invent a size before backend metadata exists", () => {
    const pending = applyOutputFields({ id: "pending", title: "Imported link 1", durationSec: null }, "best-youtube");
    expect(pending.size).toBe("After analysis");
  });
});
