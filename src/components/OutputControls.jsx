import React from "react";
import { PRESETS, OUTPUT_OPTIONS, FILENAME_PATTERNS, outputFor } from "../data/mockData.js";
import { Select } from "./ui/Select.jsx";
import { Button } from "./ui/Button.jsx";

/** Global output settings: quality preset cards + default format + filename pattern. */
export function OutputControls({ preset, setPreset, outputOption, setOutputOption, pattern, setPattern, onApplyAll, disabled = false }) {
  const selectedOutput = outputFor(outputOption);
  return (
    <div>
      <div className="il-label" style={{ marginBottom: 10 }}>Quality preset</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        {PRESETS.map((p) => {
          const on = preset === p.id;
          return (
            <button key={p.id} onClick={() => setPreset(p.id)} disabled={disabled} aria-pressed={on} style={{
              textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", padding: "11px 12px", borderRadius: "var(--radius-md)",
              border: "1px solid " + (on ? "var(--accent-primary)" : "var(--border-hairline)"),
              background: on ? "var(--surface-lcd)" : "var(--surface-panel)",
              boxShadow: on ? "0 0 0 1px var(--accent-primary), var(--shadow-card)" : "var(--shadow-card)",
              fontFamily: "var(--font-ui)", transition: "border-color 120ms ease", opacity: disabled ? 0.55 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 13, height: 13, borderRadius: "50%", flex: "none",
                  border: "1px solid " + (on ? "var(--accent-primary-press)" : "var(--border-strong)"),
                  background: on ? "var(--grad-primary)" : "var(--surface-panel)",
                  boxShadow: on ? "inset 0 0 0 2px var(--text-on-accent)" : "var(--shadow-inset)",
                }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-body)", fontWeight: "var(--weight-regular)", color: "var(--text-primary)", lineHeight: "var(--leading-tight)" }}>{p.name}</span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 5, fontFamily: "var(--font-typewriter)" }}>{p.spec}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 3, fontFamily: "var(--font-typewriter)" }}>{p.technical}</div>
              {p.tag && <div style={{ fontFamily: "var(--font-typewriter)", fontSize: 10, fontWeight: "var(--weight-regular)", color: "var(--accent-vintage)", marginTop: 4 }}>{p.tag}</div>}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
        <div style={{ flex: 1.35, minWidth: 0 }}>
          <div className="il-label" style={{ marginBottom: 6 }}>Output</div>
          <Select
            value={outputOption}
            onChange={(e) => setOutputOption(e.target.value)}
            options={OUTPUT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            disabled={disabled}
            aria-label="Output option"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: 1.2, minWidth: 0 }}>
          <div className="il-label" style={{ marginBottom: 6 }}>Filename</div>
          <Select value={pattern} onChange={(e) => setPattern(e.target.value)} options={FILENAME_PATTERNS} disabled={disabled} aria-label="Filename pattern" style={{ width: "100%" }} />
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontFamily: "var(--font-typewriter)", lineHeight: 1.35 }}>
        {selectedOutput.encoder} · {selectedOutput.compatibility}
      </div>

      <Button variant="secondary" size="sm" fullWidth style={{ marginTop: 12 }} onClick={onApplyAll} disabled={disabled}>
        Apply to all tracks
      </Button>
    </div>
  );
}
