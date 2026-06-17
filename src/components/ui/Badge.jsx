import React from "react";

/** Small status pill. tone: neutral | info | success | warning | error */
export function Badge({ tone = "neutral", children, iconLeft = null, style = {} }) {
  const tones = {
    neutral: { bg: "linear-gradient(180deg, #F4F4F1 0%, #E4E4DF 100%)", fg: "var(--text-secondary)", bd: "var(--border-strong)" },
    info: { bg: "linear-gradient(180deg, #EAF3FB 0%, #D2E4F2 100%)", fg: "var(--text-lcd)", bd: "var(--border-lcd-soft)" },
    success: { bg: "linear-gradient(180deg, #EEF6EC 0%, #DCEBD8 100%)", fg: "var(--text-success)", bd: "var(--border-success)" },
    warning: { bg: "linear-gradient(180deg, #FAF1DC 0%, #F1E2C0 100%)", fg: "var(--text-warning-strong)", bd: "var(--border-warning)" },
    error: { bg: "linear-gradient(180deg, #F8E6E6 0%, #EFD0D0 100%)", fg: "var(--text-error)", bd: "var(--border-error)" },
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
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-semibold)",
        letterSpacing: "var(--tracking-badge)",
        borderRadius: "var(--radius-pill)",
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        boxShadow: "var(--gloss-top), 0 1px 1px rgba(17,17,17,0.05)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {iconLeft}
      {children}
    </span>
  );
}
