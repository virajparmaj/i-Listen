import { describe, expect, it } from "vitest";
import { buildLibrary, buildPlaylists, buildTracks, parseLibraryXml } from "./libraryXml.js";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Tracks</key>
  <dict>
    <key>101</key>
    <dict>
      <key>Track ID</key><integer>101</integer>
      <key>Name</key><string>Apocalypse</string>
      <key>Artist</key><string>Cigarettes After Sex</string>
      <key>Album</key><string>Cigarettes After Sex</string>
      <key>Total Time</key><integer>290000</integer>
      <key>Year</key><integer>2017</integer>
      <key>Track Number</key><integer>4</integer>
    </dict>
    <key>102</key>
    <dict>
      <key>Track ID</key><integer>102</integer>
      <key>Name</key><string>Starboy</string>
      <key>Artist</key><string>The Weeknd</string>
      <key>Total Time</key><integer>230000</integer>
    </dict>
    <key>103</key>
    <dict>
      <key>Track ID</key><integer>103</integer>
      <key>Artist</key><string>Nameless</string>
    </dict>
  </dict>
  <key>Playlists</key>
  <array>
    <dict>
      <key>Name</key><string>Library</string>
      <key>Master</key><true/>
      <key>Playlist Items</key><array><dict><key>Track ID</key><integer>101</integer></dict></array>
    </dict>
    <dict>
      <key>Name</key><string>Music</string>
      <key>Distinguished Kind</key><integer>4</integer>
    </dict>
    <dict>
      <key>Name</key><string>Chill</string>
      <key>Playlist Persistent ID</key><string>ABCDEF1234567890</string>
      <key>Playlist Items</key>
      <array>
        <dict><key>Track ID</key><integer>101</integer></dict>
        <dict><key>Track ID</key><integer>102</integer></dict>
        <dict><key>Track ID</key><integer>999</integer></dict>
      </array>
    </dict>
  </array>
</dict>
</plist>`;

describe("buildTracks", () => {
  it("extracts fields and converts Total Time to seconds", () => {
    const tracks = buildTracks({
      101: { "Track ID": 101, Name: "Apocalypse", Artist: "Cigarettes After Sex", Album: "Cigarettes After Sex", "Total Time": 290000, Year: 2017, "Track Number": 4 },
    });
    expect(tracks["101"]).toMatchObject({
      id: 101,
      title: "Apocalypse",
      artist: "Cigarettes After Sex",
      album: "Cigarettes After Sex",
      year: "2017",
      trackNumber: 4,
      durationSec: 290,
    });
  });

  it("drops tracks without a usable Name and defaults a missing artist", () => {
    const tracks = buildTracks({
      1: { "Track ID": 1, Artist: "Nameless" },
      2: { "Track ID": 2, Name: "Solo" },
    });
    expect(tracks["1"]).toBeUndefined();
    expect(tracks["2"].artist).toBe("Unknown Artist");
  });
});

describe("buildPlaylists", () => {
  it("skips Master and Distinguished playlists and only references known tracks", () => {
    const tracksById = { 101: { id: 101 }, 102: { id: 102 } };
    const playlists = buildPlaylists(
      [
        { Name: "Library", Master: true, "Playlist Items": [{ "Track ID": 101 }] },
        { Name: "Music", "Distinguished Kind": 4 },
        { Name: "Chill", "Playlist Persistent ID": "PID", "Playlist Items": [{ "Track ID": 101 }, { "Track ID": 999 }] },
      ],
      tracksById,
    );
    expect(playlists).toHaveLength(1);
    expect(playlists[0]).toMatchObject({ id: "PID", name: "Chill", trackCount: 1, trackIds: [101] });
  });
});

describe("buildLibrary", () => {
  it("throws a friendly error when Tracks/Playlists are missing", () => {
    expect(() => buildLibrary({})).toThrow(/Tracks\/Playlists/);
    expect(() => buildLibrary(null)).toThrow(/Export Library/);
  });
});

describe("parseLibraryXml", () => {
  it("parses a real Apple plist export end-to-end", () => {
    const { playlists, tracksById } = parseLibraryXml(SAMPLE_XML);

    expect(Object.keys(tracksById).sort()).toEqual(["101", "102"]); // 103 has no Name
    expect(tracksById["101"]).toMatchObject({ title: "Apocalypse", year: "2017", durationSec: 290, trackNumber: 4 });
    expect(tracksById["102"]).toMatchObject({ title: "Starboy", durationSec: 230 });

    expect(playlists).toHaveLength(1);
    expect(playlists[0]).toMatchObject({ id: "ABCDEF1234567890", name: "Chill", trackCount: 2, trackIds: [101, 102] });
  });

  it("rejects empty and non-plist input", () => {
    expect(() => parseLibraryXml("")).toThrow(/empty/);
    expect(() => parseLibraryXml("not a plist")).toThrow();
  });
});
