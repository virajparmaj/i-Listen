import React from "react";
import { Card } from "./ui/Card.jsx";
import { Checkbox } from "./ui/Checkbox.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";

/** Hero + paste links + rights gate + primary CTA. */
export function PastePanel({ agreed, setAgreed, isProcessing, onStart, onPause, onAdd }) {
  const [links, setLinks] = React.useState(
    "https://youtube.com/watch?v=aXr1k09\nhttps://youtube.com/watch?v=9fbZ02p"
  );
  const count = links.split("\n").filter((l) => l.trim()).length;

  const add = () => {
    const n = onAdd(links);
    if (n > 0) setLinks("");
  };

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "22px 24px 16px" }}>
        <div style={{ fontFamily: "var(--font-deco)", fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase", color: "#9A6B3F", marginBottom: 10 }}>
          iListen Hi&middot;Fi
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 31, lineHeight: 1.06, margin: "0 0 8px", color: "var(--text-primary)" }}>
          Convert your own YouTube releases into iPod-ready music.
        </h1>
        <p style={{ fontSize: "var(--text-body-lg)", color: "var(--text-secondary)", margin: 0, maxWidth: 580, lineHeight: "var(--leading-normal)" }}>
          Paste your rights-cleared video links, batch-convert to high-quality MP3 or AAC, add metadata and cover art, then export a clean offline library for iPod Classic.
        </p>
      </div>

      <div style={{ padding: "0 24px 16px" }}>
        <label className="il-label" htmlFor="links">Paste links — one per line</label>
        <textarea
          id="links"
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          spellCheck={false}
          placeholder="https://youtube.com/watch?v=…"
          style={{
            width: "100%", boxSizing: "border-box", marginTop: 8, height: 84, resize: "vertical",
            padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-hairline)",
            background: "var(--surface-panel)", boxShadow: "var(--shadow-inset)",
            fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--text-primary)", outline: "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <Button variant="secondary" size="sm" iconLeft={<Icon name="paste" size={13} />} onClick={add} disabled={!count}>
            Add to queue
          </Button>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            {count} link{count === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div style={{ padding: "14px 24px", background: "var(--surface-recessed)", borderTop: "1px solid var(--border-soft)" }}>
        <Checkbox
          checked={agreed}
          onChange={setAgreed}
          label="I confirm I own these songs or have rights to download and convert them."
        />
      </div>

      <div style={{ padding: "14px 24px", display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid var(--border-soft)" }}>
        {isProcessing ? (
          <Button variant="secondary" size="lg" onClick={onPause}>Pause</Button>
        ) : (
          <Button variant="primary" size="lg" disabled={!agreed} onClick={onStart} iconLeft={<Icon name="play" size={15} color="#fff" emboss={false} />}>
            Start converting
          </Button>
        )}
        <a href="#workflow" style={{ fontSize: "var(--text-body)", color: "var(--text-link)" }}>View workflow</a>
        {!agreed && (
          <span style={{ marginLeft: "auto", fontSize: "var(--text-sm)", color: "var(--status-warning)" }}>
            Confirm your rights to enable
          </span>
        )}
      </div>
    </Card>
  );
}
