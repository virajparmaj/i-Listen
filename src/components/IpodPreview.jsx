import React from "react";
import { Icon } from "./ui/Icon.jsx";

/** Compact iPod Classic "Now Playing" preview with a working click wheel feel. */
export function IpodPreview({ track }) {
  const now = track || { title: "Nothing playing", artist: "—", duration: "0:00", coverArt: null, thumbColor: "var(--ipod-graphite)" };
  return (
    <div style={{
      borderRadius: "var(--radius-ipod)", padding: 16, minHeight: 420, background: "var(--grad-chrome)",
      border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-raised), var(--gloss-top)",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      <div style={{
        borderRadius: "var(--radius-sm)", background: "var(--grad-lcd)", border: "1px solid var(--border-lcd)",
        boxShadow: "var(--shadow-inset)", padding: "12px 14px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--font-lcd)", fontSize: 17, lineHeight: 1, color: "var(--text-lcd)", letterSpacing: "var(--tracking-lcd)", whiteSpace: "nowrap" }}>Now Playing</span>
          <Icon name="play" size={12} color="var(--text-lcd-muted)" emboss={false} />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            width: 42, height: 42, flex: "none", borderRadius: 3, border: "1px solid var(--border-lcd)",
            background: now.coverArt ? `center/cover no-repeat url(${now.coverArt})` : now.thumbColor,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {!now.coverArt && <Icon name="note" size={16} color="rgba(255,255,255,0.9)" emboss={false} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)", color: "var(--text-lcd-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{now.title}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-lcd-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{now.artist}</div>
          </div>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(79,99,115,0.25)", margin: "10px 0 4px", overflow: "hidden" }}>
          <div style={{ width: "38%", height: "100%", background: "var(--accent-primary)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-lcd)", fontSize: 15, letterSpacing: "var(--tracking-lcd)", color: "var(--accent-primary)" }}>
          <span>1:24</span><span>-{now.duration}</span>
        </div>
      </div>

      <div style={{
        width: 176, height: 176, margin: "0 auto 8px", borderRadius: "50%",
        background: "radial-gradient(circle at 50% 38%, #FCFCFB 0%, #E2E2DE 58%, #C4C4BF 100%)",
        border: "1px solid #A6A6A1",
        boxShadow: "inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -3px 5px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
      }}>
        <span style={{ position: "absolute", top: 17, fontFamily: "var(--font-typewriter)", fontSize: 9, fontWeight: "var(--weight-regular)", letterSpacing: "var(--tracking-label)", color: "var(--text-chrome-muted)", textTransform: "uppercase" }}>Menu</span>
        <span style={{ position: "absolute", bottom: 19, fontSize: 12, color: "var(--text-chrome-muted)" }}>&#9654;&#9646;&#9646;</span>
        <span style={{ position: "absolute", left: 18, fontSize: 12, color: "var(--text-chrome-muted)" }}>&#9664;&#9664;</span>
        <span style={{ position: "absolute", right: 17, fontSize: 12, color: "var(--text-chrome-muted)" }}>&#9654;&#9654;</span>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "radial-gradient(circle at 50% 35%, #F3F3F1, #D2D2CD)", border: "1px solid #ADADA8", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(0,0,0,0.18)" }} />
      </div>
    </div>
  );
}
