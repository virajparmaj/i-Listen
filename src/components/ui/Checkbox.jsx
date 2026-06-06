import React from "react";

/** Silver-bordered checkbox that fills with glossy action-blue when checked. */
export function Checkbox({ checked = false, onChange, label, description, disabled = false, style = {}, inputStyle = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label
      style={{
        position: "relative",
        display: "flex",
        alignItems: description ? "flex-start" : "center",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          position: "absolute",
          opacity: 0,
          flex: "none",
          width: 18,
          height: 18,
          marginTop: description ? 2 : 0,
          marginLeft: 0,
          marginRight: 0,
          appearance: "none",
          WebkitAppearance: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          ...inputStyle,
        }}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          flex: "none",
          width: 18,
          height: 18,
          marginTop: description ? 2 : 0,
          borderRadius: "var(--radius-xs)",
          background: checked ? "var(--grad-primary)" : "var(--surface-panel)",
          border: `1px solid ${checked ? "var(--accent-primary-press)" : "var(--border-strong)"}`,
          boxShadow: focus ? "var(--ring-focus), var(--shadow-inset)" : checked ? "var(--gloss-top-dark)" : "var(--shadow-inset)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {(label || description) && (
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {label && <span style={{ fontSize: "var(--text-body)", color: "var(--text-primary)", lineHeight: "var(--leading-snug)" }}>{label}</span>}
          {description && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "var(--leading-snug)" }}>{description}</span>}
        </span>
      )}
    </label>
  );
}
