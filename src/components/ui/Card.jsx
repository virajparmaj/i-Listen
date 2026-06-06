import React from "react";

/** Soft rounded panel. variant: panel | recessed | graphite */
export function Card({ variant = "panel", padding = 20, children, style = {}, ...rest }) {
  const variants = {
    panel: { background: "var(--surface-panel)", border: "1px solid var(--border-hairline)", boxShadow: "var(--shadow-card)", color: "var(--text-primary)" },
    recessed: { background: "var(--surface-recessed)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-inset)", color: "var(--text-primary)" },
    graphite: { background: "var(--grad-graphite)", border: "1px solid #1f1f21", boxShadow: "var(--shadow-card), var(--gloss-top-dark)", color: "var(--text-on-dark)" },
  };
  const v = variants[variant] || variants.panel;
  return (
    <div style={{ borderRadius: "var(--radius-md)", padding, ...v, ...style }} {...rest}>
      {children}
    </div>
  );
}
