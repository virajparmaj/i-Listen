import React from "react";
import { PRESETS } from "../data/mockData.js";

const PRIMARY_PRESETS = ["best", "ipodSafe", "mp3"];

/** Import-level quality choice. Advanced output and filenames live in Settings. */
export function OutputControls({ preset, setPreset, disabled = false, compact = false }) {
  const presets = PRESETS.filter((p) => PRIMARY_PRESETS.includes(p.id));
  return (
    <div className={`il-output-controls${compact ? " il-output-controls-compact" : ""}`}>
      <div className="il-label" style={{ marginBottom: 10 }}>Quality preset</div>
      <div className="il-preset-grid">
        {presets.map((p) => {
          const on = preset === p.id;
          return (
            <button
              key={p.id}
              className={`il-preset-card${on ? " is-active" : ""}`}
              onClick={() => setPreset(p.id)}
              disabled={disabled}
              aria-pressed={on}
            >
              <div className="il-preset-head">
                <span className="il-preset-radio" aria-hidden="true" />
                <span className="il-preset-name">{p.name}</span>
              </div>
              <div className="il-preset-copy">{p.spec}</div>
              <div className="il-preset-copy il-preset-copy-technical">{p.technical}</div>
              {p.tag && <div className="il-preset-tag">{p.tag}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
