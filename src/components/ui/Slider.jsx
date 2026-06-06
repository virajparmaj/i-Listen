import React from "react";

/** Range slider with a brushed metal knob and LCD value readout. */
export function Slider({ value, min = 0, max = 100, step = 1, onChange, style = {} }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, ...style }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        className="il-slider"
        style={{ flex: 1 }}
      />
      <span style={{
        fontFamily: "var(--font-lcd)",
        fontSize: 22,
        lineHeight: 1,
        color: "var(--accent-primary)",
        minWidth: 28,
        textAlign: "center",
        background: "var(--surface-lcd)",
        border: "1px solid #A9C4DC",
        borderRadius: "var(--radius-xs)",
        padding: "3px 8px",
        boxShadow: "var(--shadow-inset)",
      }}>{value}</span>
    </div>
  );
}
