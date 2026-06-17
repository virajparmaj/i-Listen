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
    primary: { background: "var(--grad-primary)", color: "var(--text-on-accent)", border: "1px solid var(--accent-primary-press)", boxShadow: "var(--shadow-card), var(--gloss-aqua)", radius: "var(--radius-pill)", textShadow: "0 1px 1px rgba(20,50,90,0.45)" },
    secondary: { background: "var(--grad-chrome)", color: "var(--text-primary)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card), var(--gloss-top)", radius: "var(--radius-sm)" },
    graphite: { background: "var(--grad-graphite)", color: "var(--text-on-dark)", border: "1px solid #1f1f21", boxShadow: "var(--shadow-card), var(--gloss-top-dark)", radius: "var(--radius-sm)", textShadow: "0 1px 1px rgba(0,0,0,0.5)" },
    ghost: { background: "transparent", color: "var(--accent-primary)", border: "1px solid transparent", boxShadow: "none", radius: "var(--radius-sm)" },
    danger: { background: "linear-gradient(180deg, #D98A8A 0%, #C97373 49%, #B75D5D 51%, #A24F4F 100%)", color: "var(--text-on-accent)", border: "1px solid #9c4a4a", boxShadow: "var(--shadow-card), var(--gloss-aqua)", radius: "var(--radius-pill)", textShadow: "0 1px 1px rgba(70,20,20,0.5)" },
  };
  const v = variants[variant] || variants.secondary;
  const { radius, ...vStyle } = v;

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
        fontWeight: "var(--weight-semibold)",
        borderRadius: radius,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? "100%" : "auto",
        whiteSpace: "nowrap",
        transition: "filter 120ms ease, transform 80ms ease",
        ...vStyle,
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
