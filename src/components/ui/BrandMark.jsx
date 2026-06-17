import React from "react";

const LOGO_SRC = "/i-listen-logo.png";

export function BrandMark({
  showWordmark = false,
  size = 32,
  label = "iListen",
  subtitle = null,
  className = "",
  style = {},
  imageStyle = {},
  wordmarkStyle = {},
}) {
  const imageSize = typeof size === "number" ? `${size}px` : size;

  return (
    <div
      className={`il-brandmark ${className}`.trim()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
        ...style,
      }}
    >
      <img
        src={LOGO_SRC}
        alt={showWordmark ? "" : label}
        aria-hidden={showWordmark ? true : undefined}
        width={size}
        height={size}
        style={{
          width: imageSize,
          height: imageSize,
          display: "block",
          flex: "none",
          borderRadius: "50%",
          objectFit: "cover",
          boxShadow: "0 1px 2px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.28)",
          ...imageStyle,
        }}
      />
      {showWordmark ? (
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1, ...wordmarkStyle }}>
          <span
            className="il-brandmark-wordmark"
            style={{
              fontFamily: "var(--font-deco)",
              fontSize: 19,
              fontWeight: "var(--weight-semibold)",
              letterSpacing: "-0.01em",
              color: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "var(--ipod-lcd)" }}>i</span>Listen
          </span>
          {subtitle ? (
            <span
              className="il-brandmark-subtitle"
              style={{
                marginTop: 4,
                fontFamily: "var(--font-typewriter)",
                fontSize: "var(--text-xs)",
                letterSpacing: "var(--tracking-label)",
                color: "currentColor",
                opacity: 0.72,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
