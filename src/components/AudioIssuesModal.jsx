import React from "react";
import { AUDIO_ISSUES, AUDIO_REPAIR_PRESETS, AUDIO_REPAIR_PRESET_MAP, audioAnalysisSummary, defaultAudioRepairPreset } from "../utils/audioRepair.js";
import { Modal } from "./ui/Modal.jsx";
import { Checkbox } from "./ui/Checkbox.jsx";
import { Select } from "./ui/Select.jsx";
import { Button } from "./ui/Button.jsx";
import { Badge } from "./ui/Badge.jsx";

export function AudioIssuesModal({ open, track, busy = false, onClose, onSave, onAnalyze, onRepair, onClear }) {
  const [tags, setTags] = React.useState([]);
  const [preset, setPreset] = React.useState("bass-safe-plus");

  React.useEffect(() => {
    if (!open || !track) return;
    setTags(track.audioIssueTags || []);
    setPreset(track.audioRepairPreset || defaultAudioRepairPreset(track));
  }, [open, track]);

  if (!track) return null;

  const summary = audioAnalysisSummary(track);
  const selectedPreset = AUDIO_REPAIR_PRESET_MAP[preset] || AUDIO_REPAIR_PRESETS[0];
  const hasTag = (value) => tags.includes(value);
  const setTag = (value, checked) => {
    setTags((prev) => {
      const next = new Set(prev);
      if (checked) next.add(value);
      else next.delete(value);
      return [...next];
    });
  };

  const payload = { audioIssueTags: tags, preset };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={`Audio Issues — ${track.title}`}
      width={520}
      footer={(
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="secondary" disabled={busy} onClick={() => onClear?.(track)}>Cleared / fixed</Button>
          <Button variant="primary" disabled={busy} onClick={() => onSave?.(track, payload)}>Save flags</Button>
        </>
      )}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Badge tone={(track.audioIssueTags || []).length ? "warning" : "neutral"}>
            {(track.audioIssueTags || []).length ? "Needs audio repair" : "No active issue"}
          </Badge>
          {track.audioRepairStatus && <Badge tone={track.audioRepairStatus === "repaired" ? "success" : track.audioRepairStatus === "failed" ? "error" : "info"}>{track.audioRepairStatus.replace(/_/g, " ")}</Badge>}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {AUDIO_ISSUES.map((issue) => (
            <Checkbox
              key={issue.value}
              checked={hasTag(issue.value)}
              onChange={(checked) => setTag(issue.value, checked)}
              disabled={busy}
              label={issue.label}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAnalyze?.(track, payload)}>Analyze</Button>
          <span style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            {summary.length ? summary.join(" · ") : "No stored analysis"}
          </span>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="il-label">Repair preset</span>
          <Select
            value={preset}
            onChange={(event) => setPreset(event.target.value)}
            options={AUDIO_REPAIR_PRESETS.map((item) => ({ value: item.value, label: item.label }))}
            disabled={busy}
            style={{ width: "100%" }}
          />
        </label>

        <div style={{
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-soft)",
          background: "var(--surface-panel)",
          fontFamily: "var(--font-typewriter)",
          fontSize: "var(--text-xs)",
          color: "var(--text-secondary)",
          lineHeight: 1.45,
        }}>
          {selectedPreset.detail}
        </div>

        <Button variant="secondary" disabled={busy || !tags.length} onClick={() => onRepair?.(track, payload)}>
          {busy ? "Working..." : "Reconvert"}
        </Button>
      </div>
    </Modal>
  );
}
