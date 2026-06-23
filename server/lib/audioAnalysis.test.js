import { describe, expect, it } from "vitest";
import { parseAstatsOutput } from "./audioAnalysis.js";

describe("audio astats parser", () => {
  it("summarizes peak and left/right channel differences", () => {
    const stderr = `
[Parsed_astats_0 @ 0x123] Channel: 1
[Parsed_astats_0 @ 0x123] DC offset: 0.012
[Parsed_astats_0 @ 0x123] Min level: -0.999
[Parsed_astats_0 @ 0x123] Max level: 0.998
[Parsed_astats_0 @ 0x123] Peak level dB: -0.05
[Parsed_astats_0 @ 0x123] RMS level dB: -9.0
[Parsed_astats_0 @ 0x123] Flat factor: 0.001
[Parsed_astats_0 @ 0x123] Peak count: 18
[Parsed_astats_0 @ 0x123] Channel: 2
[Parsed_astats_0 @ 0x123] DC offset: 0.000
[Parsed_astats_0 @ 0x123] Min level: -0.500
[Parsed_astats_0 @ 0x123] Max level: 0.501
[Parsed_astats_0 @ 0x123] Peak level dB: -4.0
[Parsed_astats_0 @ 0x123] RMS level dB: -14.0
[Parsed_astats_0 @ 0x123] Flat factor: 0.000
[Parsed_astats_0 @ 0x123] Peak count: 2
`;
    const analysis = parseAstatsOutput(stderr, {
      streams: [{ codec_type: "audio", codec_name: "aac", channels: 2 }],
      format: { duration: "180.5" },
    });

    expect(analysis.channels).toHaveLength(2);
    expect(analysis.channels[0]).toMatchObject({
      name: "left",
      peakLevelDb: -0.05,
      rmsLevelDb: -9,
      clipping: true,
    });
    expect(analysis.comparisons).toMatchObject({
      peakLevelDeltaDb: 3.95,
      rmsLevelDeltaDb: 5,
      dcOffsetDelta: 0.012,
      peakCountDelta: 16,
    });
    expect(analysis.flags).toMatchObject({
      clipping: true,
      leftHotterOrNoisier: true,
    });
    expect(analysis.summary).toEqual([
      "peaks too hot",
      "left channel hotter/noisier",
      "channel DC offset mismatch",
    ]);
  });
});
