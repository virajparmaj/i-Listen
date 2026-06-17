import React from "react";
import { Card } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";
import { BrandMark } from "./ui/BrandMark.jsx";
import { LinkChipsInput } from "./LinkChipsInput.jsx";

/** Paste links + primary conversion CTA. */
export function PastePanel({ onAdd, onConvert, queueCount = 0, helper, outputControls = null }) {
  const [links, setLinks] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [converting, setConverting] = React.useState(false);
  const count = links.length;

  const add = async () => {
    if (!count) return;
    setBusy(true);
    try {
      const n = await onAdd(links.join("\n"));
      if (n > 0) setLinks([]);
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    setConverting(true);
    try {
      await onConvert();
    } finally {
      setConverting(false);
    }
  };

  const helperReady = helper?.connected && helper?.tools?.ready;
  const helperCopy = helper?.pairing
    ? "Checking helper"
    : helperReady
      ? queueCount
        ? `${queueCount} queued`
        : "Queue empty"
      : helper?.connected
        ? "Tools needed"
        : "Helper offline";

  return (
    <Card className="il-import-card" style={{ padding: 0, overflow: "hidden" }}>
      <div className={`il-import-grid${outputControls ? "" : " il-import-grid-single"}`}>
        <div className="il-paste-entry">
          <div className="il-paste-brand-row">
            <BrandMark
              size={34}
              style={{ color: "var(--text-primary)" }}
            />
            <div style={{ minWidth: 0 }}>
              <h1 className="il-paste-title">Import YouTube links</h1>
              <div className="il-paste-subtitle">iPod-ready audio</div>
            </div>
          </div>

          <label className="il-label" htmlFor="links">Paste links</label>
          <LinkChipsInput inputId="links" value={links} onChange={setLinks} />
          <div className="il-link-actions">
            <Button variant="secondary" size="sm" iconLeft={<Icon name="paste" size={13} />} onClick={add} disabled={!count || busy}>
              Add to queue
            </Button>
            <span className="il-link-count">
              {count} ready
            </span>
          </div>
        </div>

        {outputControls && (
          <aside className="il-import-settings">
            {outputControls}
          </aside>
        )}
      </div>

      <div className="il-convert-row">
        <Button
          variant="primary"
          size="md"
          disabled={!queueCount || !helperReady || converting}
          onClick={convert}
        >
          {converting ? "Converting" : "Convert"}
        </Button>
        <span className="il-convert-hint">
          {helperCopy}
        </span>
      </div>
    </Card>
  );
}
