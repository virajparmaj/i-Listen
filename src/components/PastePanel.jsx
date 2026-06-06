import React from "react";
import { Card } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";

/** Paste links + primary conversion CTA. */
export function PastePanel({ onAdd, onConvert, queueCount = 0, helper }) {
  const [links, setLinks] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const count = links.split("\n").filter((l) => l.trim()).length;

  const add = async () => {
    setBusy(true);
    try {
      const n = await onAdd(links);
      if (n > 0) setLinks("");
    } finally {
      setBusy(false);
    }
  };

  const helperReady = helper?.connected && helper?.tools?.ready;
  const helperCopy = helper?.connected
    ? helperReady
      ? "Local helper ready. YouTube audio will be converted on this Mac."
      : "Local helper connected, but yt-dlp, ffmpeg, or ffprobe still needs setup."
    : `Local helper not connected. Run ${helper?.setupCommand || "npm run helper"} to enable conversion.`;

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "22px 24px 16px" }}>
        <div style={{ fontFamily: "var(--font-deco)", fontSize: 12, letterSpacing: "var(--tracking-deco)", textTransform: "uppercase", color: "var(--accent-vintage)", marginBottom: 10 }}>
          iListen Hi&middot;Fi
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", fontWeight: "var(--weight-regular)", lineHeight: 1.06, margin: "0 0 8px", color: "var(--text-primary)" }}>
          Paste YouTube links. Convert iPod-ready files.
        </h1>
      </div>

      <div style={{ padding: "0 24px 16px" }}>
        <label className="il-label" htmlFor="links">Paste links — one per line</label>
        <textarea
          id="links"
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          spellCheck={false}
          placeholder="https://youtube.com/watch?v=..."
          style={{
            width: "100%", boxSizing: "border-box", marginTop: 8, height: 84, resize: "vertical",
            padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-hairline)",
            background: "var(--surface-panel)", boxShadow: "var(--shadow-inset)",
            fontFamily: "var(--font-typewriter)", fontSize: "var(--text-sm)", color: "var(--text-primary)", outline: "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <Button variant="secondary" size="sm" iconLeft={<Icon name="paste" size={13} />} onClick={add} disabled={!count || busy}>
            Add to queue
          </Button>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontFamily: "var(--font-typewriter)" }}>
            {count} YouTube link{count === 1 ? "" : "s"} ready
          </span>
        </div>
      </div>

      <div className="il-paste-actions" style={{ padding: "14px 24px", display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid var(--border-soft)" }}>
        <Button variant="primary" size="lg" disabled={!queueCount || !helperReady} onClick={onConvert}>
          Convert queued links
        </Button>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontFamily: "var(--font-typewriter)", lineHeight: 1.35 }}>
          {helperCopy}
        </span>
      </div>
    </Card>
  );
}
