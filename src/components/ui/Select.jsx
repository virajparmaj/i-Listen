import React from "react";

/** Brushed-chrome popup menu wrapping a native <select>. */
export function Select({ value, onChange, options = [], disabled = false, size = "md", style = {}, ...rest }) {
  const sizes = {
    sm: { height: "var(--control-h-sm)", font: "var(--text-sm)" },
    md: { height: "var(--control-h)", font: "var(--text-body)" },
    lg: { height: "var(--control-h-lg)", font: "var(--text-body-lg)" },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        height: s.height,
        background: "var(--grad-chrome)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-sm)",
        boxShadow: "var(--shadow-card), var(--gloss-top)",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          height: "100%",
          padding: "0 32px 0 12px",
          fontSize: s.font,
          fontFamily: "var(--font-ui)",
          color: "var(--text-primary)",
          cursor: disabled ? "not-allowed" : "pointer",
          width: "100%",
        }}
        {...rest}
      >
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
      <span style={{ position: "absolute", right: 10, pointerEvents: "none", color: "var(--text-secondary)", display: "flex" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </div>
  );
}
