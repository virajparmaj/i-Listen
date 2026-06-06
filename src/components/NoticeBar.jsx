import React from "react";
import { Icon } from "./ui/Icon.jsx";

/** Legal / quality advisory strip — stated plainly, never buried. */
export function NoticeBar() {
  return (
    <div style={{
      display: "flex", gap: 11, alignItems: "flex-start", padding: "11px 14px",
      background: "var(--status-warning-soft)", border: "1px solid #E0CB8F",
      borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)",
    }}>
      <span style={{ flex: "none", marginTop: 1 }}><Icon name="warn" size={18} color="#8A6A1E" /></span>
      <p style={{ fontSize: "var(--text-sm)", color: "#6E561C", lineHeight: "var(--leading-snug)", margin: 0 }}>
        This tool is intended only for content you own, created, licensed, or otherwise have rights to download and convert.
        Do not use it to download copyrighted music you do not own or bypass DRM. YouTube audio is already compressed — for
        best quality, use original WAV, FLAC, or AIFF masters when available.
      </p>
    </div>
  );
}
