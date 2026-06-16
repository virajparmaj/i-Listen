import React from "react";
import { Card } from "../ui/Card.jsx";
import { Checkbox } from "../ui/Checkbox.jsx";
import { Badge } from "../ui/Badge.jsx";

/**
 * Lists the user playlists found in the library. Selecting a playlist marks all
 * of its tracks for import (individual songs can be unchecked in TrackSelectList).
 */
export function PlaylistPicker({ playlists = [], selectedIds, onToggle }) {
  if (!playlists.length) {
    return (
      <Card variant="recessed" padding={18}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          No user playlists were found in this library file.
        </div>
      </Card>
    );
  }

  return (
    <Card variant="panel" padding={16} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-secondary)", marginBottom: 4 }}>
        Playlists ({playlists.length})
      </div>
      {playlists.map((playlist) => (
        <div
          key={playlist.id}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            padding: "8px 10px", borderRadius: "var(--radius-sm)",
            background: selectedIds.has(playlist.id) ? "var(--surface-lcd)" : "transparent",
          }}
        >
          <Checkbox
            checked={selectedIds.has(playlist.id)}
            onChange={() => onToggle(playlist.id)}
            label={playlist.name}
          />
          <Badge tone="neutral">{playlist.trackCount} track{playlist.trackCount === 1 ? "" : "s"}</Badge>
        </div>
      ))}
    </Card>
  );
}
