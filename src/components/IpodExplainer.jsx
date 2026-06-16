import React from "react";
import { Card } from "./ui/Card.jsx";
import { Icon } from "./ui/Icon.jsx";

const label = { fontFamily: "var(--font-display)", fontSize: "var(--text-body-lg)", lineHeight: 1.1 };
const body = { fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 };

/**
 * Static explainer: the two faces of a connected iPod and why only Apple
 * Music / Finder sync makes songs playable.
 */
export function IpodExplainer() {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name="note" size={16} color="var(--accent-primary)" />
        <span style={label}>How songs actually reach your iPod</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card variant="recessed" style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Icon name="done" size={13} color="var(--status-success)" />
            <strong style={{ fontSize: "var(--text-sm)" }}>“Viraj Parmar’s iPod”</strong>
          </div>
          <div style={body}>
            The real sync device. Apple Music and Finder write the iPod’s playable
            music database here. This is what you sync to.
          </div>
        </Card>

        <Card variant="recessed" style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Icon name="warn" size={13} color="var(--status-warning)" />
            <strong style={{ fontSize: "var(--text-sm)" }}>plain “iPod” disk</strong>
          </div>
          <div style={body}>
            Disk-use storage only. Dragging songs here in Finder does <strong>not</strong> make
            them playable — it never updates the iPod music database.
          </div>
        </Card>
      </div>

      <div style={{ ...body, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-hairline)" }}>
        iListen prepares clean files and hands them into the Apple Music app + the
        <strong> “iPod Sync”</strong> playlist. The final step — syncing that playlist to the
        iPod — is done once in Finder, by design.
      </div>
    </Card>
  );
}
