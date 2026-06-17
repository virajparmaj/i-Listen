import React from "react";
import { Card } from "./ui/Card.jsx";
import { Badge } from "./ui/Badge.jsx";
import { Button } from "./ui/Button.jsx";
import { Input } from "./ui/Input.jsx";
import { Icon } from "./ui/Icon.jsx";

function fmtBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const gb = n / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(n / 1024 / 1024).toFixed(0)} MB`;
}

const labelStyle = { fontFamily: "var(--font-display)", fontSize: "var(--text-body-lg)", lineHeight: 1.1 };
const rowKey = { fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", minWidth: 132 };
const rowVal = { fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

function Row({ k, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span style={rowKey}>{k}</span>
      <span style={rowVal}>{children}</span>
    </div>
  );
}

/**
 * Live iPod detection: connection, capacity/free space, disk-use mode, whether
 * Finder can sync it, plus a manual "choose iPod volume" fallback.
 */
export function IpodDevicePanel({ ipod, helperConnected, onRefresh, onSelect, onShowToast }) {
  const [manualPath, setManualPath] = React.useState("");
  const device = ipod?.device || { connected: false };
  const connected = Boolean(device.connected);

  const verify = async () => {
    const path = manualPath.trim();
    if (!path) return;
    try {
      const result = await onSelect(path);
      onShowToast?.(`Using iPod volume: ${result.device?.name || path}`);
    } catch (error) {
      onShowToast?.(error.message);
    }
  };

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name="prefs" size={16} color="var(--accent-primary)" />
        <span style={labelStyle}>Connected iPod</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Badge tone={connected ? "success" : "neutral"}>{connected ? "Connected" : "Not detected"}</Badge>
          <Button size="sm" variant="secondary" disabled={!helperConnected} onClick={onRefresh}>Refresh</Button>
        </span>
      </div>

      {connected ? (
        <div style={{ display: "grid", gap: 7 }}>
          <Row k="Name">{device.name || "iPod"}</Row>
          <Row k="Capacity">{fmtBytes(device.capacityBytes)}</Row>
          <Row k="Free space">{device.diskUseEnabled ? fmtBytes(device.freeBytes) : "Enable disk use to read"}</Row>
          <Row k="Disk path">{device.volumePath || "Not mounted (disk use off)"}</Row>
          <Row k="Disk use">
            <Badge tone={device.diskUseEnabled ? "info" : "neutral"}>{device.diskUseEnabled ? "Enabled" : "Off"}</Badge>
          </Row>
          <Row k="Finder sync">
            <Badge tone={device.canSyncViaFinder ? "success" : "warning"}>{device.canSyncViaFinder ? "Visible as sync device" : "Not visible"}</Badge>
          </Row>
        </div>
      ) : (
        <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {helperConnected
            ? "No iPod detected — connect over USB, then Refresh."
            : "Connect the helper to detect an iPod."}
        </div>
      )}

      <div style={{
        marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-hairline)",
        display: "grid", gap: 8,
      }}>
        <span style={rowKey}>Choose volume manually</span>
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            placeholder="/Volumes/iPod"
            style={{ flex: 1 }}
          />
          <Button size="md" variant="secondary" disabled={!helperConnected || !manualPath.trim()} onClick={verify}>Verify &amp; use</Button>
        </div>
        {ipod?.selectedPath && (
          <div style={rowVal}>Selected: {ipod.selectedPath}</div>
        )}
      </div>
    </Card>
  );
}
