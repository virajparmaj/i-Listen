import { probeMedia, runProcess } from "./converter.js";

function num(value) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function keyFor(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function channelName(index) {
  if (index === 1) return "left";
  if (index === 2) return "right";
  return `channel${index}`;
}

function compactChannel(raw = {}, index) {
  const maxLevel = num(raw.maxLevel);
  const minLevel = num(raw.minLevel);
  const peakLevelDb = num(raw.peakLevelDB ?? raw.peakLevelDb);
  const rmsLevelDb = num(raw.rmsLevelDB ?? raw.rmsLevelDb);
  const dcOffset = num(raw.dcOffset);
  const flatFactor = num(raw.flatFactor);
  const peakCount = num(raw.peakCount);
  const absoluteMax = Math.max(Math.abs(maxLevel ?? 0), Math.abs(minLevel ?? 0));

  return {
    index,
    name: channelName(index),
    peakLevelDb,
    rmsLevelDb,
    dcOffset,
    flatFactor,
    peakCount,
    maxLevel,
    minLevel,
    absoluteMax,
    nearClipping: (peakLevelDb != null && peakLevelDb >= -1) || absoluteMax >= 0.98,
    clipping: (peakLevelDb != null && peakLevelDb >= -0.1) || absoluteMax >= 0.995,
  };
}

function delta(leftValue, rightValue) {
  if (leftValue == null || rightValue == null) return null;
  const value = leftValue - rightValue;
  return Number.isFinite(value) ? Number(value.toFixed(3)) : null;
}

function buildComparisons(channels = []) {
  const left = channels.find((channel) => channel.index === 1);
  const right = channels.find((channel) => channel.index === 2);
  if (!left || !right) return {};

  return {
    peakLevelDeltaDb: delta(left.peakLevelDb, right.peakLevelDb),
    rmsLevelDeltaDb: delta(left.rmsLevelDb, right.rmsLevelDb),
    dcOffsetDelta: delta(left.dcOffset, right.dcOffset),
    peakCountDelta: delta(left.peakCount, right.peakCount),
  };
}

function buildSummary(channels = [], comparisons = {}) {
  const summary = [];
  if (channels.some((channel) => channel.clipping)) summary.push("peaks too hot");
  else if (channels.some((channel) => channel.nearClipping)) summary.push("peaks near clipping");

  const rmsDelta = comparisons.rmsLevelDeltaDb;
  const peakDelta = comparisons.peakLevelDeltaDb;
  if ((rmsDelta != null && rmsDelta >= 1.5) || (peakDelta != null && peakDelta >= 1.5)) {
    summary.push("left channel hotter/noisier");
  } else if ((rmsDelta != null && rmsDelta <= -1.5) || (peakDelta != null && peakDelta <= -1.5)) {
    summary.push("right channel hotter/noisier");
  }

  if (comparisons.dcOffsetDelta != null && Math.abs(comparisons.dcOffsetDelta) >= 0.01) {
    summary.push("channel DC offset mismatch");
  }

  return summary;
}

export function parseAstatsOutput(text = "", probe = {}) {
  const rawChannels = new Map();
  let current = null;

  String(text || "").split(/\r?\n/).forEach((line) => {
    const clean = line.replace(/^\[[^\]]+\]\s*/, "").trim();
    const channelMatch = clean.match(/^Channel:\s*(\d+)/i);
    if (channelMatch) {
      current = Number(channelMatch[1]);
      if (!rawChannels.has(current)) rawChannels.set(current, {});
      return;
    }

    if (!current) return;
    const statMatch = clean.match(/^([^:]+):\s*(-?(?:\d+(?:\.\d+)?|\.\d+|inf|-inf|nan))/i);
    if (!statMatch) return;
    const [, label, value] = statMatch;
    rawChannels.get(current)[keyFor(label)] = value;
  });

  const channels = [...rawChannels.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, raw]) => compactChannel(raw, index));
  const comparisons = buildComparisons(channels);
  const summary = buildSummary(channels, comparisons);
  const audioStream = (probe.streams || []).find((stream) => stream.codec_type === "audio") || {};

  return {
    analyzedAt: new Date().toISOString(),
    durationSec: num(probe.format?.duration),
    codec: audioStream.codec_name || "",
    channelCount: num(audioStream.channels) || channels.length || null,
    channels,
    comparisons,
    flags: {
      clipping: channels.some((channel) => channel.clipping),
      nearClipping: channels.some((channel) => channel.nearClipping),
      leftHotterOrNoisier: summary.includes("left channel hotter/noisier"),
      rightHotterOrNoisier: summary.includes("right channel hotter/noisier"),
    },
    summary,
  };
}

export async function analyzeAudio({ tools, inputPath, run = runProcess, probe = probeMedia } = {}) {
  if (!tools?.ffmpeg?.path || !tools?.ffprobe?.path) {
    throw new Error("ffmpeg and ffprobe are required to analyze audio.");
  }
  if (!inputPath) throw new Error("Cannot analyze audio: missing input file.");

  const mediaProbe = await probe(tools.ffprobe.path, inputPath);
  const { stderr } = await run(tools.ffmpeg.path, [
    "-hide_banner",
    "-nostats",
    "-i", inputPath,
    "-vn",
    "-filter_complex", "astats=metadata=0:reset=0",
    "-f", "null",
    "-",
  ]);
  return parseAstatsOutput(stderr, mediaProbe);
}
