import React from "react";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { Badge } from "../ui/Badge.jsx";
import { Input } from "../ui/Input.jsx";
import { chosenUrl } from "../../hooks/useXmlImport.js";

function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function confidenceTone(value) {
  if (value >= 70) return "success";
  if (value >= 55) return "info";
  return "warning";
}

function MatchRow({ match, track, actions }) {
  const candidates = match.candidates || [];
  const index = Math.min(match.chosenIndex ?? 0, Math.max(0, candidates.length - 1));
  const candidate = candidates[index] || null;
  const manual = String(match.manualUrl || "").trim();
  const resolved = chosenUrl(match);

  return (
    <Card
      variant={match.flagged && !manual ? "recessed" : "panel"}
      padding={14}
      style={{ display: "flex", flexDirection: "column", gap: 10, borderLeft: `3px solid ${resolved ? "var(--accent-primary)" : "var(--status-warning)"}` }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-medium)", color: "var(--text-primary)" }}>
            {track.title}
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {track.artist}{track.album ? ` · ${track.album}` : ""} · {fmtDuration(track.durationSec)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {match.flagged && !manual && <Badge tone="warning">Check match</Badge>}
          {candidate && !manual && (
            <Badge tone={confidenceTone(candidate.confidence)}>{candidate.confidence}% match</Badge>
          )}
        </div>
      </div>

      {manual ? (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
          Manual URL: <span style={{ fontFamily: "var(--font-mono)" }}>{manual}</span>
        </div>
      ) : candidate ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{candidate.title}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              {candidate.channel || "Unknown channel"} · {fmtDuration(candidate.durationSec)}
              {Number.isFinite(candidate.durationDeltaSec) && candidate.durationDeltaSec !== 0
                ? ` (${candidate.durationDeltaSec > 0 ? "+" : ""}${candidate.durationDeltaSec}s)`
                : ""}
              {candidates.length > 1 ? ` · ${index + 1}/${candidates.length}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flex: "none" }}>
            <Button
              variant="ghost" size="sm"
              disabled={index <= 0}
              onClick={() => actions.setMatchCandidate(match.trackId, index - 1)}
            >Prev</Button>
            <Button
              variant="ghost" size="sm"
              disabled={index >= candidates.length - 1}
              onClick={() => actions.setMatchCandidate(match.trackId, index + 1)}
            >Next</Button>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-warning-strong)" }}>
          No YouTube match found{match.error ? ` (${match.error})` : ""}. Paste a link or skip.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Input
          size="sm"
          placeholder="Paste a YouTube link to override…"
          value={match.manualUrl || ""}
          onChange={(e) => actions.setManualUrl(match.trackId, e.target.value)}
          style={{ flex: 1 }}
        />
        <Button variant="danger" size="sm" onClick={() => actions.dropMatch(match.trackId)}>Skip</Button>
      </div>
    </Card>
  );
}

/** Review list: one row per matched track with its chosen YouTube candidate. */
export function MatchReview({ entries = [], actions }) {
  if (!entries.length) {
    return (
      <Card variant="recessed" padding={18}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          No matches to review. Go back and select some tracks.
        </div>
      </Card>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {entries.map(({ match, track }) => (
        <MatchRow key={match.trackId} match={match} track={track} actions={actions} />
      ))}
    </div>
  );
}
