import React from "react";
import { STATUS } from "../data/mockData.js";
import { Badge } from "./ui/Badge.jsx";
import { ProgressBar } from "./ui/ProgressBar.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";

function Thumb({ track }) {
  return (
    <div style={{
      width: 46, height: 46, flex: "none", borderRadius: "var(--radius-xs)",
      border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-inset)",
      background: track.coverArt ? `center/cover no-repeat url(${track.coverArt})` : track.thumbColor,
      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
    }}>
      {!track.coverArt && <Icon name="note" size={20} color="rgba(255,255,255,0.92)" emboss={false} />}
    </div>
  );
}

export function QueueRow({ track, last, onEdit, onArt, onDownload, onRetry, onRemove }) {
  const st = STATUS[track.status];
  const isDone = track.status === "complete";
  const isFail = track.status === "failed";
  const isSkip = track.status === "skipped";
  const inFlight = !["queued", "complete", "failed", "skipped"].includes(track.status);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "46px minmax(0,1fr) 168px 150px", gap: 14, alignItems: "center",
      padding: "12px 18px", borderBottom: last ? "none" : "1px solid var(--border-soft)",
      background: isDone ? "rgba(122,168,116,0.06)" : isFail ? "rgba(183,93,93,0.05)" : "transparent",
    }}>
      <Thumb track={track} />

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: "var(--text-body)", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {track.title}
          </span>
          {track.warning && <Icon name="warn" size={14} color="var(--status-warning)" />}
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {track.artist} · {track.format.toUpperCase()} · {track.size} · {track.duration}
        </div>
        {isFail && track.error && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--status-error)", marginTop: 2 }}>{track.error}</div>
        )}
      </div>

      <div>
        {inFlight ? (
          <>
            <ProgressBar value={track.progress} showLabel />
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 4 }}>{st.label}</div>
          </>
        ) : (
          <Badge tone={st.tone}>{st.label}</Badge>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
        {isDone && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onArt(track)} title="Cover art"><Icon name="art" size={14} /></Button>
            <Button size="sm" variant="ghost" onClick={() => onEdit(track)} title="Edit metadata"><Icon name="prefs" size={14} /></Button>
            <Button size="sm" variant="secondary" iconLeft={<Icon name="get" size={13} />} onClick={() => onDownload(track)}>Save</Button>
          </>
        )}
        {isFail && (
          <Button size="sm" variant="secondary" onClick={() => onRetry(track)}>Retry</Button>
        )}
        {(track.status === "queued" || isSkip) && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onEdit(track)} title="Edit metadata"><Icon name="prefs" size={14} /></Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(track)} title="Remove"><Icon name="trash" size={14} color="var(--text-secondary)" /></Button>
          </>
        )}
        {inFlight && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>working…</span>}
      </div>
    </div>
  );
}
