import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chooseOutputPlan, writePlaylists } from "./converter.js";
const probe = (codec, formatName) => ({
  streams: [{ codec_type: "audio", codec_name: codec }],
  format: { format_name: formatName },
});

let tempDir = null;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("smart output planning", () => {
  it("copies iPod-compatible AAC from MP4/M4A sources", () => {
    const plan = chooseOutputPlan({ outputOption: "best-youtube" }, probe("aac", "mov,mp4,m4a,3gp,3g2,mj2"));

    expect(plan.mode).toBe("copy-aac");
    expect(plan.args).toEqual(["-c:a", "copy"]);
  });

  it("uses ALAC for non-iPod YouTube audio in best-available mode", () => {
    const plan = chooseOutputPlan({ outputOption: "best-youtube" }, probe("opus", "matroska,webm"));

    expect(plan.codec).toBe("alac");
    expect(plan.args).toEqual(["-c:a", "alac"]);
  });

  it("keeps advanced MP3 V0 available", () => {
    const plan = chooseOutputPlan({ outputOption: "mp3-v0" }, probe("opus", "matroska,webm"));

    expect(plan.codec).toBe("mp3");
    expect(plan.args).toEqual(["-c:a", "libmp3lame", "-q:a", "0"]);
  });

  it("writes one playlist file for each assigned playlist plus an all export", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "ilisten-playlists-"));
    const outputPath = join(tempDir, "exports", "Music Library", "Artist", "Singles", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, "");

    const result = await writePlaylists({ exportsDir: join(tempDir, "exports") }, [{
      id: "job-1",
      status: "complete",
      outputPath,
      playlists: ["iPod - Chill", "iPod - Artist"],
    }]);

    expect(result.count).toBe(1);
    expect(result.playlists.map((item) => item.name)).toEqual(["iPod - Chill", "iPod - Artist"]);
    expect(result.all.path.endsWith("iListen Export.m3u")).toBe(true);
  });
});
