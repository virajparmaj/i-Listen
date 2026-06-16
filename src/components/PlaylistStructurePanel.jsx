import React from "react";
import { Card } from "./ui/Card.jsx";
import { Badge } from "./ui/Badge.jsx";
import { Icon } from "./ui/Icon.jsx";

const MASTER = "iPod Sync";

const labelStyle = { fontFamily: "var(--font-display)", fontSize: "var(--text-body-lg)", lineHeight: 1.1 };
const treeText = { fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-primary)" };
const mutedText = { fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" };

/**
 * Preview the Apple Music structure iListen will create: a folder "iListen"
 * containing the master playlist plus one playlist per preserved source group.
 */
export function PlaylistStructurePanel({ tracks }) {
  const ready = tracks.filter((t) => t.status === "complete" && t.metadataReviewStatus === "approved");

  const groups = new Map();
  ready.forEach((track) => {
    (track.playlists || []).forEach((name) => {
      const clean = String(name || "").trim();
      if (!clean || clean === MASTER || /^ipod\s*-/i.test(clean)) return;
      groups.set(clean, (groups.get(clean) || 0) + 1);
    });
  });
  const sources = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name="queue" size={16} color="var(--accent-primary)" />
        <span style={labelStyle}>Apple Music playlists</span>
        <span style={{ marginLeft: "auto" }}>
          <Badge tone="info">{ready.length} track{ready.length === 1 ? "" : "s"}</Badge>
        </span>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="prefs" size={13} color="var(--text-secondary)" />
          <span style={treeText}><strong>iListen</strong></span>
          <span style={mutedText}>(folder)</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 18 }}>
          <span style={mutedText}>└</span>
          <Icon name="note" size={13} color="var(--accent-primary)" />
          <span style={treeText}><strong>{MASTER}</strong></span>
          <span style={mutedText}>· master · {ready.length}</span>
        </div>

        {sources.map(([name, count]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 18 }}>
            <span style={mutedText}>└</span>
            <Icon name="note" size={13} color="var(--text-secondary)" />
            <span style={treeText}>{name}</span>
            <span style={mutedText}>· {count}</span>
          </div>
        ))}

        {!sources.length && (
          <div style={{ ...mutedText, paddingLeft: 18, lineHeight: 1.5 }}>
            Add playlist names in a track’s metadata (e.g. “Hindi Mix”) to create
            custom playlists under the iListen folder.
          </div>
        )}
      </div>
    </Card>
  );
}
