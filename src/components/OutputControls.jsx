import React from "react";
import { PRESETS, FORMAT_OPTIONS, FILENAME_PATTERNS } from "../data/mockData.js";
import { Select } from "./ui/Select.jsx";
import { Button } from "./ui/Button.jsx";

/** Global output settings: quality preset cards + default format + filename pattern. */
export function OutputControls({ preset, setPreset, format, setFormat, pattern, setPattern, onApplyAll }) {
  return (
    <div>
      <div className="il-label" style={{ marginBottom: 10 }}>Quality preset</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        {PRESETS.map((p) => {
          const on = preset === p.id;
          return (
            <button key={p.id} onClick={() => setPreset(p.id)} style={{
              textAlign: "left", cursor: "pointer", padding: "11px 12px", borderRadius: "var(--radius-md)",
              border: "1px solid " + (on ? "var(--accent-primary)" : "var(--border-hairline)"),
              background: on ? "var(--surface-lcd)" : "var(--surface-panel)",
              boxShadow: on ? "0 0 0 1px var(--accent-primary), var(--shadow-card)" : "var(--shadow-card)",
              fontFamily: "var(--font-ui)", transition: "border-color 120ms ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 13, height: 13, borderRadius: "50%", flex: "none",
                  border: "1px solid " + (on ? "var(--accent-primary-press)" : "var(--border-strong)"),
                  background: on ? "var(--grad-primary)" : "var(--surface-panel)",
                  boxShadow: on ? "inset 0 0 0 2px #fff" : "var(--shadow-inset)",
                }} />
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 5, fontFamily: "var(--font-mono)" }}>{p.spec}</div>
              {p.tag && <div style={{ fontSize: 10, fontWeight: 600, color: "var(--accent-primary-press)", marginTop: 4 }}>{p.tag}</div>}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div className="il-label" style={{ marginBottom: 6 }}>Format</div>
          <Select value={format} onChange={(e) => setFormat(e.target.value)} options={FORMAT_OPTIONS} style={{ width: "100%" }} />
        </div>
        <div style={{ flex: 1.4 }}>
          <div className="il-label" style={{ marginBottom: 6 }}>Filename</div>
          <Select value={pattern} onChange={(e) => setPattern(e.target.value)} options={FILENAME_PATTERNS} style={{ width: "100%" }} />
        </div>
      </div>

      <Button variant="secondary" size="sm" fullWidth style={{ marginTop: 12 }} onClick={onApplyAll}>
        Apply to all tracks
      </Button>
    </div>
  );
}
