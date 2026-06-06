import React from "react";

/** Recessed LCD-style progress track with a glossy fill. */
export function ProgressBar({ value = 0, tone = "primary", height = 8, showLabel = false, style = {}, label = "Progress" }) {
  const pct = Math.max(0, Math.min(100, value));
  const fills = {
    primary: "var(--grad-primary)",
    success: "linear-gradient(180deg, #8FBA88 0%, var(--status-success) 100%)",
    warning: "linear-gradient(180deg, #D8B45C 0%, var(--status-warning) 100%)",
  };
  const fill = fills[tone] || fills.primary;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, ...style }}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        style={{
          flex: 1,
          height,
          borderRadius: "var(--radius-pill)",
          background: "var(--surface-recessed)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-inset)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: fill,
            borderRadius: "var(--radius-pill)",
            boxShadow: "var(--gloss-top-dark)",
            transition: "width 240ms ease",
          }}
        />
      </div>
      {showLabel && (
        <span style={{ fontFamily: "var(--font-lcd)", fontSize: 16, letterSpacing: "var(--tracking-lcd)", color: "var(--text-lcd)", minWidth: 34, textAlign: "right", lineHeight: 1 }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
