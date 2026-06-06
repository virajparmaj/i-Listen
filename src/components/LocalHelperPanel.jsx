import React from "react";
import { Card } from "./ui/Card.jsx";
import { Badge } from "./ui/Badge.jsx";
import { Icon } from "./ui/Icon.jsx";

function ToolLine({ tool }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <Icon name={tool?.ok ? "done" : "warn"} size={13} color={tool?.ok ? "var(--status-success)" : "var(--status-warning)"} />
      <span style={{ minWidth: 58, fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{tool?.name || "tool"}</span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "var(--text-xs)", color: tool?.ok ? "var(--text-primary)" : "var(--text-warning-strong)" }}>
        {tool?.ok ? tool.path : tool?.error || "missing"}
      </span>
    </div>
  );
}

export function LocalHelperPanel({ helper }) {
  const connected = helper.connected;
  const ready = connected && helper.tools?.ready;
  const checking = helper.pairing || !helper.checked || (connected && !helper.tools);
  const tone = checking ? "warning" : connected ? "warning" : "error";
  const title = checking ? "Checking local helper" : connected ? "Helper needs tools" : "Local helper offline";
  const message = checking
    ? "Looking for the localhost converter."
    : connected
      ? "Install or configure the missing converter tools before starting jobs."
      : helper.error || `Run ${helper.setupCommand} in this project, then reload.`;

  if (ready) return null;

  return (
    <Card className="il-helper-popover il-fade-in" role="status" aria-live="polite" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon name={connected || checking ? "warn" : "fail"} size={16} color={connected || checking ? "var(--status-warning)" : "var(--status-error)"} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-body-lg)", lineHeight: 1.1 }}>{title}</span>
        <span style={{ marginLeft: "auto" }}>
          <Badge tone={tone}>{checking ? "Checking" : connected ? "Needs tools" : "Offline"}</Badge>
        </span>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.45 }}>
          {message}
        </div>

        <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {helper.helperUrl}
        </div>

        {helper.project?.root && (
          <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {helper.project.root}
          </div>
        )}

        {helper.tools && (
          <div style={{ display: "grid", gap: 5, paddingTop: 4 }}>
            <ToolLine tool={helper.tools.ytdlp} />
            <ToolLine tool={helper.tools.ffmpeg} />
            <ToolLine tool={helper.tools.ffprobe} />
          </div>
        )}
      </div>
    </Card>
  );
}
