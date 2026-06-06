import React from "react";

/** iOS-style toggle switch with brushed track. */
export function Switch({ checked = false, onChange, disabled = false, label, style = {} }) {
  const toggle = () => !disabled && onChange && onChange(!checked);
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, ...style }}>
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } }}
        style={{
          width: 40,
          height: 24,
          flex: "none",
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--grad-primary)" : "var(--surface-recessed)",
          border: `1px solid ${checked ? "var(--accent-primary-press)" : "var(--border-strong)"}`,
          boxShadow: checked ? "var(--gloss-top-dark)" : "var(--shadow-inset)",
          position: "relative",
          transition: "background 140ms ease, border-color 140ms ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: checked ? 17 : 1,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 35%, #FFFFFF, #E8E8E4)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
            transition: "left 140ms ease",
          }}
        />
      </span>
      {label && <span style={{ fontSize: "var(--text-body)", color: "var(--text-primary)" }}>{label}</span>}
    </label>
  );
}
