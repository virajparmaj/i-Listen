import React from "react";
import { Card } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";
import { QueueRow } from "./QueueRow.jsx";

export function Queue({ tracks, onEdit, onArt, onDownload, onRetry, onRemove, onCancel, onClear, locked = false, selectedIds = new Set(), onToggleSelect }) {
  const done = tracks.filter((t) => t.status === "complete").length;
  const failed = tracks.filter((t) => t.status === "failed").length;

  return (
    <Card className="il-queue-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 18px", borderBottom: "1px solid var(--border-soft)", background: "var(--grad-chrome)" }}>
        <Icon name="queue" size={18} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--weight-semibold)", fontSize: "var(--text-h3)", letterSpacing: "-0.01em", lineHeight: "var(--leading-tight)" }}>Conversion queue</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {done} done{failed ? ` · ${failed} failed` : ""} · {tracks.length} total
          </span>
          <Button size="sm" variant="ghost" onClick={onClear} disabled={!done || locked}>Clear done</Button>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="il-queue-empty" style={{ padding: "40px 18px", textAlign: "center", color: "var(--text-secondary)" }}>
          <Icon name="note" size={28} color="var(--border-strong)" style={{ margin: "0 auto 10px" }} />
          <div style={{ fontSize: "var(--text-body)" }}>Your queue is empty.</div>
          <div style={{ fontSize: "var(--text-sm)" }}>Paste YouTube links above to prepare iPod-ready files.</div>
        </div>
      ) : (
        <div className="il-queue-list il-scroll">
          {tracks.map((t, i) => (
            <QueueRow
              key={t.id}
              track={t}
              last={i === tracks.length - 1}
              onEdit={onEdit}
              onArt={onArt}
              onDownload={onDownload}
              onRetry={onRetry}
              onRemove={onRemove}
              onCancel={onCancel}
              locked={locked}
              selected={selectedIds.has(t.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
