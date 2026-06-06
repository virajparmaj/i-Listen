import React from "react";
import { Icon } from "./ui/Icon.jsx";

export function LogsPanel({ lines }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  const color = (kind) =>
    kind === "ok" ? "#9FD49A" : kind === "warn" ? "#E2C172" : kind === "err" ? "#E59A9A" : "#D6E3EC";

  return (
    <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid #1c1c1e", boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--grad-graphite)", boxShadow: "var(--gloss-top-dark)" }}>
        <Icon name="logs" size={16} color="#cfd6db" emboss={false} />
        <span style={{ color: "#e6e9ec", fontSize: "var(--text-sm)", fontWeight: 600 }}>Logs</span>
        <span style={{ marginLeft: "auto", color: "#8a929a", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>{lines.length} lines</span>
      </div>
      <div ref={ref} className="il-scroll" style={{ background: "var(--surface-graphite)", padding: "12px 14px", height: 170, overflow: "auto" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono)", lineHeight: 1.7, color: color(l.kind), wordBreak: "break-word" }}>
            <span style={{ color: "#7E8B95" }}>{l.t}</span>{" "}
            {l.label && <span style={{ fontWeight: 600 }}>{l.label} </span>}
            {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
