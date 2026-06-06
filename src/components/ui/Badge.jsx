import React from "react";

/** Small status pill. tone: neutral | info | success | warning | error */
export function Badge({ tone = "neutral", children, iconLeft = null, style = {} }) {
  const tones = {
    neutral: { bg: "var(--surface-recessed)", fg: "var(--text-secondary)", bd: "var(--border-strong)" },
    info: { bg: "var(--surface-lcd)", fg: "var(--accent-primary-press)", bd: "#A9C4DC" },
    success: { bg: "var(--status-success-soft)", fg: "#4C7A47", bd: "#B9D2B4" },
    warning: { bg: "var(--status-warning-soft)", fg: "#8A6A1E", bd: "#E0CB8F" },
    error: { bg: "var(--status-error-soft)", fg: "#8E4444", bd: "#DFB6B6" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 20,
        padding: "0 9px",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-semibold)",
        letterSpacing: "0.02em",
        borderRadius: "var(--radius-pill)",
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {iconLeft}
      {children}
    </span>
  );
}
