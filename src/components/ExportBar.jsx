import React from "react";
import { Card } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";

/** Export / download actions. */
export function ExportBar({ completeCount, totalCount, locked = false, helperConnected = false, onZip, onLibrary, onCSV, onSelected }) {
  const exportDisabled = locked || (helperConnected ? !completeCount : !totalCount);
  const reportDisabled = locked || !totalCount;
  const libraryDisabled = locked || !completeCount;
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--weight-regular)", fontSize: "var(--text-h3)", lineHeight: "var(--leading-tight)" }}>Export</span>
        <span style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
          {totalCount} queued · {completeCount} converted
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Button variant="primary" fullWidth disabled={exportDisabled} iconLeft={<Icon name="queue" size={14} color="var(--text-on-accent)" emboss={false} />} onClick={onZip}>
          {helperConnected ? "Create iPod playlist" : "Download conversion plan"}
        </Button>
        <Button variant="secondary" fullWidth disabled={reportDisabled} iconLeft={<Icon name="get" size={14} />} onClick={onSelected}>
          Project report
        </Button>
        <Button variant="secondary" fullWidth disabled={libraryDisabled} iconLeft={<Icon name="zip" size={14} />} onClick={onLibrary}>
          Download library report
        </Button>
        <Button variant="ghost" fullWidth iconLeft={<Icon name="csv" size={14} />} onClick={onCSV}>CSV report</Button>
      </div>
    </Card>
  );
}
