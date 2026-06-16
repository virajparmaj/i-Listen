import React from "react";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { Icon } from "../ui/Icon.jsx";

/**
 * Drop zone / file picker for an Apple Music "Export Library…" .xml file.
 * Hands the selected File to onFile; rendering of progress/errors is the parent's job.
 */
export function LibraryUpload({ onFile, busy = false, error = "", disabled = false }) {
  const inputRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);

  const pick = (file) => {
    if (file && onFile) onFile(file);
  };

  return (
    <Card variant="recessed" padding={28} style={{ textAlign: "center" }}>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) pick(e.dataTransfer.files?.[0]);
        }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
          padding: "32px 20px", borderRadius: "var(--radius-md)",
          border: `2px dashed ${dragging ? "var(--accent-primary)" : "var(--border-strong)"}`,
          background: dragging ? "var(--surface-lcd)" : "transparent",
          transition: "border-color 120ms ease, background 120ms ease",
        }}
      >
        <Icon name="logs" size={28} color="var(--text-secondary)" emboss={false} />
        <div>
          <div style={{ fontSize: "var(--text-body-lg)", fontWeight: "var(--weight-medium)", color: "var(--text-primary)" }}>
            Convert with XML
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 4, maxWidth: 420 }}>
            Drop your Apple Music <strong>Library.xml</strong> here, or choose it below. In Music: File → Library → Export Library…
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xml,application/xml,text/xml"
          style={{ display: "none" }}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button variant="primary" size="md" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Reading…" : "Choose Library.xml"}
        </Button>
        {error && (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-error)", maxWidth: 460 }}>{error}</div>
        )}
        {disabled && (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-warning-strong)" }}>
            Start the local helper (npm run helper) to import a library.
          </div>
        )}
      </div>
    </Card>
  );
}
