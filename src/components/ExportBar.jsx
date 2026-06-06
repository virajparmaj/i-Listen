import React from "react";
import { Card } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";

/** Export / download actions. */
export function ExportBar({ completeCount, totalCount, onZip, onLibrary, onCSV, onLogs, onSelected }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: "var(--text-body)" }}>Export</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
          {completeCount}/{totalCount} ready
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Button variant="primary" fullWidth disabled={!completeCount} iconLeft={<Icon name="zip" size={14} color="#fff" emboss={false} />} onClick={onZip}>
          Download all as ZIP
        </Button>
        <Button variant="secondary" fullWidth disabled={!completeCount} iconLeft={<Icon name="get" size={14} />} onClick={onSelected}>
          Download selected
        </Button>
        <Button variant="secondary" fullWidth disabled={!completeCount} iconLeft={<Icon name="queue" size={14} />} onClick={onLibrary}>
          Download organized library
        </Button>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" style={{ flex: 1 }} iconLeft={<Icon name="csv" size={14} />} onClick={onCSV}>CSV report</Button>
          <Button variant="ghost" style={{ flex: 1 }} iconLeft={<Icon name="logs" size={14} />} onClick={onLogs}>Logs</Button>
        </div>
      </div>
    </Card>
  );
}
