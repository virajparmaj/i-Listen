import React from "react";
import { Card } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";
import { QueueRow } from "./QueueRow.jsx";
import { TERMINAL } from "../data/mockData.js";

export function Queue({ tracks, onEdit, onArt, onDownload, onRetry, onRemove, onClear }) {
  const done = tracks.filter((t) => t.status === "complete").length;
  const failed = tracks.filter((t) => t.status === "failed").length;

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 18px", borderBottom: "1px solid var(--border-soft)", background: "var(--grad-chrome)" }}>
        <Icon name="queue" size={18} />
        <span style={{ fontWeight: 600, fontSize: "var(--text-body)" }}>Batch processing queue</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {done} done{failed ? ` · ${failed} failed` : ""} · {tracks.length} total
          </span>
          <Button size="sm" variant="ghost" onClick={onClear} disabled={!done}>Clear done</Button>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div style={{ padding: "40px 18px", textAlign: "center", color: "var(--text-secondary)" }}>
          <Icon name="note" size={28} color="var(--border-strong)" style={{ margin: "0 auto 10px" }} />
          <div style={{ fontSize: "var(--text-body)" }}>Your queue is empty.</div>
          <div style={{ fontSize: "var(--text-sm)" }}>Paste links above and add them to the queue.</div>
        </div>
      ) : (
        <div>
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
            />
          ))}
        </div>
      )}
    </Card>
  );
}
