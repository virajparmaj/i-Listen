import React from "react";
import { Card } from "./ui/Card.jsx";
import { Icon } from "./ui/Icon.jsx";

const body = { fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 };

/**
 * Static explainer: the two faces of a connected iPod and why only Apple
 * Music / Finder sync makes songs playable.
 */
export function IpodExplainer() {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card variant="recessed" style={{ padding: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="done" size={14} color="var(--status-success)" />
          <span style={body}>
            <strong style={{ color: "var(--text-primary)" }}>“Viraj Parmar’s iPod”</strong> — the real sync device.
          </span>
        </Card>

        <Card variant="recessed" style={{ padding: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="warn" size={14} color="var(--status-warning)" />
          <span style={body}>
            <strong style={{ color: "var(--text-primary)" }}>plain “iPod” disk</strong> — storage only, not playable.
          </span>
        </Card>
      </div>
    </Card>
  );
}
