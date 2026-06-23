export const AUDIO_ISSUES = [
  { value: "bass_crackle", label: "Bass crackle", shortLabel: "Bass" },
  { value: "left_channel_disturbance", label: "Left ear issue", shortLabel: "Left" },
];

export const AUDIO_REPAIR_PRESETS = [
  {
    value: "bass-safe-plus",
    label: "Bass Safe Plus",
    detail: "Bass Safe Plus adds more headroom.",
  },
  {
    value: "left-channel-soften",
    label: "Left Channel Soften",
    detail: "Reduces mild left-only artifacts.",
  },
  {
    value: "stereo-blend-safe",
    label: "Stereo Blend Safe",
    detail: "Stereo Blend reduces left-only artifacts.",
  },
  {
    value: "mono-rescue",
    label: "Mono Rescue",
    detail: "Mono Rescue is last resort.",
  },
  {
    value: "right-channel-rescue",
    label: "Right Channel Rescue",
    detail: "Use only when the left channel is clearly damaged.",
  },
];

export const AUDIO_REPAIR_PRESET_MAP = Object.fromEntries(AUDIO_REPAIR_PRESETS.map((preset) => [preset.value, preset]));
export const AUDIO_ISSUE_MAP = Object.fromEntries(AUDIO_ISSUES.map((issue) => [issue.value, issue]));

export function audioIssueLabels(track = {}) {
  return (track.audioIssueTags || [])
    .map((tag) => AUDIO_ISSUE_MAP[tag]?.shortLabel || AUDIO_ISSUE_MAP[tag]?.label)
    .filter(Boolean);
}

export function hasAudioIssue(track, issue) {
  return (track.audioIssueTags || []).includes(issue);
}

export function needsAudioRepair(track = {}) {
  return Boolean((track.audioIssueTags || []).length)
    || ["needs_repair", "failed"].includes(track.audioRepairStatus || "");
}

export function defaultAudioRepairPreset(track = {}) {
  if (hasAudioIssue(track, "bass_crackle")) return "bass-safe-plus";
  if (hasAudioIssue(track, "left_channel_disturbance")) return "stereo-blend-safe";
  return track.audioRepairPreset || "bass-safe-plus";
}

export function filterByAudioIssues(tracks = [], filter = {}) {
  if (!filter?.bassCrackle && !filter?.leftChannel && !filter?.needsRepair) return tracks;
  return tracks.filter((track) => {
    if (filter.bassCrackle && !hasAudioIssue(track, "bass_crackle")) return false;
    if (filter.leftChannel && !hasAudioIssue(track, "left_channel_disturbance")) return false;
    if (filter.needsRepair && !needsAudioRepair(track)) return false;
    return true;
  });
}

export function audioAnalysisSummary(track = {}) {
  const analysis = track.audioAnalysis || {};
  const summary = analysis.summary || analysis.after?.summary || analysis.current?.summary || analysis.before?.summary || [];
  return Array.isArray(summary) ? summary : [];
}
