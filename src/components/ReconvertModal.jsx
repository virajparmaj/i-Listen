import React from "react";
import { OUTPUT_OPTIONS, outputFor } from "../data/mockData.js";
import { Modal } from "./ui/Modal.jsx";
import { Select } from "./ui/Select.jsx";
import { Button } from "./ui/Button.jsx";

const RECONVERT_OPTIONS = [
  { value: "best-youtube", label: "Best Available" },
  { value: "ipod-safe-aac", label: "Bass Safe" },
  { value: "mp3-v0", label: "iPod MP3" },
  { value: "aac-256", label: "Apple Native / AAC 256" },
];

const OPTION_DETAILS = Object.fromEntries(OUTPUT_OPTIONS.map((option) => [option.value, option]));

export function ReconvertModal({ open, tracks = [], defaultOutputOption = "ipod-safe-aac", busy = false, onClose, onConfirm }) {
  const [outputOption, setOutputOption] = React.useState(defaultOutputOption);

  React.useEffect(() => {
    if (open) setOutputOption(defaultOutputOption || "ipod-safe-aac");
  }, [defaultOutputOption, open]);

  const count = tracks.length;
  const first = tracks[0];
  const selected = OPTION_DETAILS[outputOption] || outputFor(outputOption);
  const title = count > 1 ? `Reconvert ${count} tracks` : `Reconvert — ${first?.title || "track"}`;

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      width={520}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || !count}
            onClick={() => onConfirm(outputOption)}
          >
            {busy ? "Rebuilding..." : count > 1 ? `Reconvert ${count}` : "Reconvert"}
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ fontSize: "var(--text-body)", color: "var(--text-primary)", lineHeight: 1.45 }}>
          Rebuild this file from the saved source/link.
        </div>
        <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.45 }}>
          Bass Safe lowers peaks for older iPods. After reconvert, add the corrected file to Apple Music again and sync in Finder.
        </div>
        {count > 1 && (
          <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            {tracks.slice(0, 3).map((track) => `${track.artist} — ${track.title}`).join(" · ")}
            {count > 3 ? ` · ${count - 3} more` : ""}
          </div>
        )}
        <label style={{ display: "grid", gap: 6 }}>
          <span className="il-label">Output</span>
          <Select
            value={outputOption}
            onChange={(event) => setOutputOption(event.target.value)}
            options={RECONVERT_OPTIONS}
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
          {selected.encoder}
        </div>
      </div>
    </Modal>
  );
}
