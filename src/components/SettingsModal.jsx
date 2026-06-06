import React from "react";
import { Modal } from "./ui/Modal.jsx";
import { Select } from "./ui/Select.jsx";
import { Slider } from "./ui/Slider.jsx";
import { Switch } from "./ui/Switch.jsx";
import { Button } from "./ui/Button.jsx";
import { FORMAT_OPTIONS, TAG_VERSIONS, FILENAME_PATTERNS } from "../data/mockData.js";

function Row({ label, hint, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0", borderBottom: "1px solid var(--border-soft)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--text-body)", fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
        {hint && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 1 }}>{hint}</div>}
      </div>
      <div style={{ flex: "none" }}>{children}</div>
    </div>
  );
}

export function SettingsModal({ open, settings, onClose, onChange }) {
  const set = (patch) => onChange(patch);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      width={580}
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      <Row label="Parallel jobs" hint="How many tracks convert at once (1–8).">
        <div style={{ width: 220 }}>
          <Slider value={settings.parallelJobs} min={1} max={8} step={1} onChange={(v) => set({ parallelJobs: v })} />
        </div>
      </Row>
      <Row label="Default output format">
        <Select value={settings.defaultFormat} onChange={(e) => set({ defaultFormat: e.target.value })} options={FORMAT_OPTIONS} />
      </Row>
      <Row label="Metadata tag version">
        <Select value={settings.tagVersion} onChange={(e) => set({ tagVersion: e.target.value })} options={TAG_VERSIONS} />
      </Row>
      <Row label="Filename pattern">
        <Select value={settings.filenamePattern} onChange={(e) => set({ filenamePattern: e.target.value })} options={FILENAME_PATTERNS} style={{ maxWidth: 240 }} />
      </Row>
      <Row label="Skip already converted" hint="Don't re-add links that are already in your library.">
        <Switch checked={settings.skipConverted} onChange={(v) => set({ skipConverted: v })} />
      </Row>
      <Row label="Avoid overwrite" hint="Append a suffix instead of overwriting existing files.">
        <Switch checked={settings.avoidOverwrite} onChange={(v) => set({ avoidOverwrite: v })} />
      </Row>
      <Row label="Generate logs" hint="Record each processing step in the logs panel.">
        <Switch checked={settings.generateLogs} onChange={(v) => set({ generateLogs: v })} />
      </Row>
      <Row label="Resize artwork" hint="Downscale large covers to 800×800 before embedding.">
        <Switch checked={settings.resizeArtwork} onChange={(v) => set({ resizeArtwork: v })} />
      </Row>
    </Modal>
  );
}
