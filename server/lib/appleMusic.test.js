import { describe, expect, it } from "vitest";
import { classifyOsascriptError, ILISTEN_FOLDER, MASTER_PLAYLIST } from "./appleMusic.js";

describe("appleMusic handoff helpers", () => {
  it("uses the iListen folder and master playlist names", () => {
    expect(ILISTEN_FOLDER).toBe("iListen");
    expect(MASTER_PLAYLIST).toBe("iPod Sync");
  });

  it("classifies a macOS Automation (TCC) denial", () => {
    const classified = classifyOsascriptError({
      stderr: "execution error: Not authorized to send Apple events to Music. (-1743)",
    });
    expect(classified.kind).toBe("tcc-denied");
    expect(classified.userMessage).toMatch(/Automation/);
  });

  it("classifies Music not running", () => {
    const classified = classifyOsascriptError({
      stderr: "Music got an error: Application isn't running. (-600)",
    });
    expect(classified.kind).toBe("music-not-running");
  });

  it("falls back to unknown for unexpected errors", () => {
    const classified = classifyOsascriptError({ message: "some weird failure" });
    expect(classified.kind).toBe("unknown");
    expect(classified.userMessage).toContain("weird");
  });
});
