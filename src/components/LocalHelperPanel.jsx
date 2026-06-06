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
  const tone = ready ? "success" : connected ? "warning" : "error";

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon name={ready ? "done" : "warn"} size={16} color={ready ? "var(--status-success)" : "var(--status-warning)"} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-body-lg)", lineHeight: 1.1 }}>Local helper</span>
        <span style={{ marginLeft: "auto" }}>
          <Badge tone={tone}>{ready ? "Ready" : connected ? "Needs tools" : "Offline"}</Badge>
        </span>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.45 }}>
          {ready
            ? "Conversions run on this Mac through the localhost helper."
            : connected
              ? "Install or configure the missing converter tools before starting jobs."
              : `Run ${helper.setupCommand} in this project, then reload the web app.`}
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
