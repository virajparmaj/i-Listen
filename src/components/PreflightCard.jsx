import React from "react";
import { Badge } from "./ui/Badge.jsx";
import { Button } from "./ui/Button.jsx";
import { Card } from "./ui/Card.jsx";

function Line({ tone = "neutral", label, detail, action = null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border-hairline)" }}>
      <Badge tone={tone}>{label}</Badge>
      <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{detail}</span>
      {action}
    </div>
  );
}

/**
 * "Before you sync" — shows how the Apple Music playlist has drifted from what
 * iListen believes, and offers a reconcile that fixes it in place.
 *
 * This replaces the delete-and-rebuild-the-playlist ritual.
 */
export function PreflightCard({ preflight, busy = false, onRefresh, onReconcile, disabled = false }) {
  if (!preflight) {
    return (
      <Card>
        <div className="il-label">Before you sync</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            Check the Apple Music playlist against your approved tracks.
          </span>
          <Button onClick={onRefresh} disabled={disabled || busy}>{busy ? "Checking…" : "Check playlist"}</Button>
        </div>
      </Card>
    );
  }

  if (preflight.blocked) {
    return (
      <Card>
        <div className="il-label">Before you sync</div>
        <div style={{ marginTop: 8, fontSize: "var(--text-sm)", color: "var(--text-error)" }}>{preflight.message}</div>
      </Card>
    );
  }

  const { playlist, expectedCount, matches, drift = {}, otherPlaylists = [], otherTrackTotal = 0 } = preflight;
  const count = playlist?.trackCount ?? 0;
  const removable = (drift.duplicates || 0) + (drift.orphans || 0);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div className="il-label" style={{ margin: 0 }}>Before you sync</div>
        <Button size="sm" onClick={onRefresh} disabled={disabled || busy}>{busy ? "Checking…" : "Re-check"}</Button>
      </div>

      <div style={{ marginTop: 10 }}>
        <Line
          tone={matches ? "success" : "warning"}
          label={matches ? "OK" : "Drift"}
          detail={`${preflight.master}: ${count} track${count === 1 ? "" : "s"} · iListen has ${expectedCount} approved`}
        />

        {drift.duplicates > 0 && (
          <Line
            tone="warning"
            label={`${drift.duplicates} duplicate`}
            detail="The same track is listed more than once."
          />
        )}

        {drift.orphans > 0 && (
          <Line
            tone="warning"
            label={`${drift.orphans} stale`}
            detail="Rows that no longer match an approved track."
          />
        )}

        {drift.cloudRows > 0 && (
          <Line
            tone="error"
            label={`${drift.cloudRows} unplayable`}
            detail="Apple Music subscription rows — these stopped playing when the subscription ended."
          />
        )}

        {drift.danglingRows > 0 && (
          <Line tone="error" label={`${drift.danglingRows} missing`} detail="Music cannot find the file for these rows." />
        )}

        {removable > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 12 }}>
            <Button variant="primary" onClick={onReconcile} disabled={disabled || busy}>
              Fix playlist ({removable} to remove)
            </Button>
          </div>
        )}

        {otherPlaylists.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-hairline)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: "var(--leading-normal)" }}>
              Finder syncs whatever you tick in its Music tab, and that choice isn’t visible to iListen.
              You have <strong>{otherPlaylists.length}</strong> other playlist{otherPlaylists.length === 1 ? "" : "s"} totalling{" "}
              <strong>{otherTrackTotal}</strong> tracks — if Finder reports more than {expectedCount}, untick everything except{" "}
              <strong>{preflight.master}</strong>.
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
