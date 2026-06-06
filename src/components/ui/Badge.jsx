import React from "react";

/** Small status pill. tone: neutral | info | success | warning | error */
export function Badge({ tone = "neutral", children, iconLeft = null, style = {} }) {
  const tones = {
    neutral: { bg: "var(--surface-recessed)", fg: "var(--text-secondary)", bd: "var(--border-strong)" },
    info: { bg: "var(--surface-lcd)", fg: "var(--text-lcd)", bd: "var(--border-lcd-soft)" },
    success: { bg: "var(--status-success-soft)", fg: "var(--text-success)", bd: "var(--border-success)" },
    warning: { bg: "var(--status-warning-soft)", fg: "var(--text-warning-strong)", bd: "var(--border-warning)" },
    error: { bg: "var(--status-error-soft)", fg: "var(--text-error)", bd: "var(--border-error)" },
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
        fontFamily: "var(--font-typewriter)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-regular)",
        letterSpacing: "var(--tracking-badge)",
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
