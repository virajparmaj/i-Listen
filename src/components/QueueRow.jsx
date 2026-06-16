import React from "react";
import { IN_FLIGHT, STATUS } from "../data/mockData.js";
import { Badge } from "./ui/Badge.jsx";
import { ProgressBar } from "./ui/ProgressBar.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";
import { ArtworkThumb } from "./ArtworkThumb.jsx";

function Thumb({ track }) {
  return (
    <ArtworkThumb
      primarySrc={track.coverArt}
      fallbackSrc={track.thumbnailUrl}
      thumbColor={track.thumbColor}
      alt={`${track.title} cover`}
      iconSize={20}
      style={{
        width: 46,
        height: 46,
        flex: "none",
        borderRadius: "var(--radius-xs)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-inset)",
      }}
    />
  );
}

export function QueueRow({ track, last, onEdit, onArt, onDownload, onRetry, onRemove, onCancel, locked = false, selected = false, onToggleSelect }) {
  const st = STATUS[track.status];
  const isDone = track.status === "complete";
  const isFail = track.status === "failed";
  const isSkip = track.status === "skipped";
  const isCanceled = track.status === "canceled";
  const inFlight = IN_FLIGHT.includes(track.status);

  return (
    <div className="il-queue-row" style={{
      display: "grid", gridTemplateColumns: "46px minmax(0,1fr) 168px 150px", gap: 14, alignItems: "center",
      padding: "12px 18px", borderBottom: last ? "none" : "1px solid var(--border-soft)",
      background: isDone ? "rgba(122,168,116,0.06)" : isFail ? "rgba(183,93,93,0.05)" : "transparent",
    }}>
      <Thumb track={track} />

      <div className="il-queue-main" style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {track.title}
          </span>
          {track.warning && <Icon name="warn" size={14} color="var(--status-warning)" />}
        </div>
        <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-sm)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {track.artist} · {track.qualityLabel || track.format.toUpperCase()} · {track.size} · {track.duration}
        </div>
        {track.playlists?.length > 0 && (
          <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
            {track.album} · {track.playlists.join(", ")}
          </div>
        )}
        {isFail && track.error && (
          <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--status-error)", marginTop: 2 }}>{track.error}</div>
        )}
      </div>

      <div className="il-queue-status">
        {inFlight ? (
          <>
            <ProgressBar value={track.progress} showLabel label={`${track.title} conversion progress`} />
            <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 4 }}>{st.label}</div>
          </>
        ) : isDone && track.metadataReviewStatus !== "approved" ? (
          <Badge tone="warning">Needs review</Badge>
        ) : isDone && track.metadataReviewStatus === "approved" ? (
          <Badge tone="success">Approved</Badge>
        ) : (
          <Badge tone={st.tone}>{st.label}</Badge>
        )}
      </div>

      <div className="il-queue-actions" style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
        {isDone && (
          <>
            <label title="Select for manifest export" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.5 : 1 }}>
              <input
                type="checkbox"
                checked={selected}
                disabled={locked}
                aria-label={`Select ${track.title} for export manifest`}
                onChange={() => onToggleSelect && onToggleSelect(track.id)}
                style={{ width: 16, height: 16, margin: 0, accentColor: "var(--accent-primary)" }}
              />
            </label>
            <Button size="sm" variant="ghost" disabled={locked} onClick={() => onArt(track)} title="Cover art"><Icon name="art" size={14} /></Button>
            <Button size="sm" variant="ghost" disabled={locked} onClick={() => onEdit(track)} title="Edit metadata"><Icon name="prefs" size={14} /></Button>
            <Button size="sm" variant="secondary" disabled={locked} iconLeft={<Icon name="get" size={13} />} onClick={() => onDownload(track)}>Manifest</Button>
          </>
        )}
        {(isFail || isCanceled) && (
          <Button size="sm" variant="secondary" disabled={locked} onClick={() => onRetry(track)}>Retry</Button>
        )}
        {(track.status === "queued" || isSkip || isCanceled) && (
          <>
            <Button size="sm" variant="ghost" disabled={locked} onClick={() => onEdit(track)} title="Edit metadata"><Icon name="prefs" size={14} /></Button>
            <Button size="sm" variant="ghost" disabled={locked} onClick={() => onRemove(track)} title="Remove"><Icon name="trash" size={14} color="var(--text-secondary)" /></Button>
          </>
        )}
        {inFlight && (
          <>
            <Button size="sm" variant="secondary" disabled={locked} onClick={() => onCancel?.(track)}>Cancel</Button>
            <span style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>working…</span>
          </>
        )}
      </div>
    </div>
  );
}
