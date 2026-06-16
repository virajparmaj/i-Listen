import React from "react";
import { Card } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";
import { revealExports } from "../utils/localHelper.js";

const labelStyle = { fontFamily: "var(--font-display)", fontSize: "var(--text-body-lg)", lineHeight: 1.1 };
const body = { fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-warning-strong)", lineHeight: 1.55 };

const STEPS = [
  "Open the Music app.",
  "File ▸ Import… and choose the exports/Music Library folder.",
  "Create or select a playlist named “iPod Sync”.",
  "Drag the imported tracks into that playlist.",
  "Connect your iPod, open Finder ▸ your iPod ▸ Music, tick the playlist, and Sync.",
];

/**
 * Shown when the Apple Music handoff is blocked (usually a macOS Automation/TCC
 * denial). Offers a retry plus the manual import-and-sync path.
 */
export function ManualFallback({ blocked, onRetry, onShowToast }) {
  if (!blocked) return null;

  const reveal = async () => {
    try {
      const result = await revealExports();
      onShowToast?.(`Opened ${result.path}`);
    } catch (error) {
      onShowToast?.(error.message);
    }
  };

  return (
    <Card style={{ padding: 16, background: "var(--status-warning-soft)", border: "1px solid var(--border-warning)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon name="warn" size={16} color="var(--status-warning)" />
        <span style={labelStyle}>Apple Music automation was blocked</span>
      </div>

      <div style={{ ...body, marginBottom: 10 }}>
        {blocked.message || "macOS blocked controlling Music."}
        {blocked.kind === "tcc-denied" && (
          <>
            {" "}Approve it under <strong>System Settings → Privacy &amp; Security → Automation →
            (your terminal / node) → Music</strong>, then retry.
          </>
        )}
      </div>

      <ol style={{ ...body, margin: "0 0 12px", paddingLeft: 18, display: "grid", gap: 4 }}>
        {STEPS.map((step) => <li key={step}>{step}</li>)}
      </ol>

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" size="md" onClick={onRetry}>Retry Apple Music</Button>
        <Button variant="secondary" size="md" onClick={reveal}>Reveal exports folder</Button>
      </div>
    </Card>
  );
}
