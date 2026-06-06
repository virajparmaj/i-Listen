import React from "react";

/** Recessed white text well with inset shadow and silver hairline. */
export function Input({
  value,
  onChange,
  placeholder = "",
  iconLeft = null,
  mono = false,
  invalid = false,
  disabled = false,
  size = "md",
  style = {},
  ...rest
}) {
  const sizes = {
    sm: { height: "var(--control-h-sm)", font: "var(--text-sm)" },
    md: { height: "var(--control-h)", font: "var(--text-body)" },
    lg: { height: "var(--control-h-lg)", font: "var(--text-body-lg)" },
  };
  const s = sizes[size] || sizes.md;
  const [focus, setFocus] = React.useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: s.height,
        padding: "0 12px",
        background: disabled ? "var(--surface-recessed)" : "var(--surface-panel)",
        border: `1px solid ${invalid ? "var(--status-error)" : "var(--border-hairline)"}`,
        borderRadius: "var(--radius-sm)",
        boxShadow: focus ? "var(--ring-focus), var(--shadow-inset)" : "var(--shadow-inset)",
        transition: "box-shadow 120ms ease, border-color 120ms ease",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {iconLeft && <span style={{ display: "flex", color: "var(--text-secondary)", flex: "none" }}>{iconLeft}</span>}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: s.font,
          fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)",
          color: "var(--text-primary)",
        }}
        {...rest}
      />
    </div>
  );
}
