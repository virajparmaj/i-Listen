import { describe, expect, it } from "vitest";
import { organizedOutputPath } from "./organize.js";

describe("organize exports", () => {
  it("builds clean artist/album output paths from approved metadata", () => {
    const path = organizedOutputPath({
      exportsDir: "/tmp/iListen/exports",
    }, {
      title: "Cry",
      artist: "Cigarettes After Sex",
      album: "Cry",
      track: "2",
      outputPath: "/tmp/iListen/exports/Music Library/Cry/2019 - Singles/02 - Cigarettes After Sex.m4a",
    });

    expect(path).toBe("/tmp/iListen/exports/Music Library/Cigarettes After Sex/Cry/02 - Cry.m4a");
  });
});
