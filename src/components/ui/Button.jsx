import React from "react";

/**
 * Brushed-metal button with a glossy top highlight (iPod / early-iTunes chrome).
 * variant: primary | secondary | graphite | ghost | danger
 * size: sm | md | lg
 */
export function Button({
  variant = "secondary",
  size = "md",
  iconLeft = null,
  iconRight = null,
  disabled = false,
  fullWidth = false,
  children,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: { height: "var(--control-h-sm)", padding: "0 12px", font: "var(--text-sm)" },
    md: { height: "var(--control-h)", padding: "0 16px", font: "var(--text-body)" },
    lg: { height: "var(--control-h-lg)", padding: "0 22px", font: "var(--text-body-lg)" },
  };
  const s = sizes[size] || sizes.md;

  const variants = {
    primary: { background: "var(--grad-primary)", color: "var(--text-on-accent)", border: "1px solid var(--accent-primary-press)", boxShadow: "var(--shadow-card), var(--gloss-top-dark)" },
    secondary: { background: "var(--grad-chrome)", color: "var(--text-primary)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card), var(--gloss-top)" },
    graphite: { background: "var(--grad-graphite)", color: "var(--text-on-dark)", border: "1px solid #1f1f21", boxShadow: "var(--shadow-card), var(--gloss-top-dark)" },
    ghost: { background: "transparent", color: "var(--accent-primary)", border: "1px solid transparent", boxShadow: "none" },
    danger: { background: "linear-gradient(180deg, #C97373 0%, var(--status-error) 100%)", color: "#fff", border: "1px solid #9c4a4a", boxShadow: "var(--shadow-card), var(--gloss-top-dark)" },
  };
  const v = variants[variant] || variants.secondary;

  return (
    <button
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: s.height,
        padding: s.padding,
        fontSize: s.font,
        fontFamily: "var(--font-ui)",
        fontWeight: "var(--weight-medium)",
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? "100%" : "auto",
        whiteSpace: "nowrap",
        transition: "filter 120ms ease, transform 80ms ease",
        ...v,
        ...style,
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "translateY(0.5px)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
