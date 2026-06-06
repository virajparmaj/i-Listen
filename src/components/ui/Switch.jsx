import React from "react";

/** iOS-style toggle switch with brushed track. */
export function Switch({ checked = false, onChange, disabled = false, label, hideLabel = false, style = {}, ...rest }) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        position: "relative",
        ...style,
      }}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={hideLabel ? label : undefined}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{
          width: 44,
          height: 24,
          flex: "none",
          appearance: "none",
          WebkitAppearance: "none",
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--grad-primary)" : "var(--surface-recessed)",
          border: `1px solid ${checked ? "var(--accent-primary-press)" : "var(--border-strong)"}`,
          boxShadow: checked ? "var(--gloss-top-dark)" : "var(--shadow-inset)",
          position: "relative",
          transition: "background 140ms ease, border-color 140ms ease",
          cursor: disabled ? "not-allowed" : "pointer",
          margin: 0,
        }}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          position: "absolute",
          left: checked ? 23 : 1,
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 35%, #FFFFFF, #E8E8E4)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          transition: "left 140ms ease",
          pointerEvents: "none",
        }}
      />
      {label && !hideLabel && <span style={{ fontSize: "var(--text-body)", color: "var(--text-primary)" }}>{label}</span>}
      {label && hideLabel && (
        <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
          {label}
      </span>
      )}
    </label>
  );
}
