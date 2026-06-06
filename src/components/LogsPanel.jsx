import React from "react";
import { Icon } from "./ui/Icon.jsx";

export function LogsPanel({ lines, height = 170, showHeader = true }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  const color = (kind) =>
    kind === "ok" ? "var(--terminal-success)" : kind === "warn" ? "var(--terminal-warning)" : kind === "err" ? "var(--terminal-error)" : "var(--text-terminal)";

  return (
    <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-graphite)", boxShadow: "var(--shadow-card)" }}>
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--grad-graphite)", boxShadow: "var(--gloss-top-dark)" }}>
          <Icon name="logs" size={16} color="var(--text-terminal)" emboss={false} />
          <span style={{ color: "var(--text-terminal)", fontFamily: "var(--font-terminal)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)" }}>Logs</span>
          <span style={{ marginLeft: "auto", color: "var(--text-terminal-muted)", fontSize: "var(--text-xs)", fontFamily: "var(--font-terminal)" }}>{lines.length} lines</span>
        </div>
      )}
      <div ref={ref} className="il-scroll" style={{ background: "var(--surface-terminal)", padding: "12px 14px", height, overflow: "auto" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: "var(--font-terminal)", fontSize: "var(--text-mono)", lineHeight: 1.7, color: color(l.kind), wordBreak: "break-word" }}>
            <span style={{ color: "var(--text-terminal-muted)" }}>{l.t}</span>{" "}
            {l.label && <span style={{ fontWeight: "var(--weight-semibold)" }}>{l.label} </span>}
            {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
