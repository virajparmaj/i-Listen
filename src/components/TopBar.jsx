import React from "react";
import { Icon } from "./ui/Icon.jsx";
import { BrandMark } from "./ui/BrandMark.jsx";

export function TopBar({ tab, setTab, onOpenSettings, jobInfo }) {
  const tabs = ["Convert", "Library"];
  return (
    <header className="il-topbar" style={{
      display: "flex", alignItems: "center", gap: 16, padding: "0 20px", height: 56,
      background: "var(--grad-graphite)", borderBottom: "1px solid var(--border-graphite)",
      boxShadow: "var(--gloss-top-dark)", color: "var(--text-on-dark)",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      <div className="il-topbar-brand" style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <BrandMark showWordmark size={30} />
      </div>
      <nav className="il-topbar-tabs" style={{ display: "flex", gap: 4, marginLeft: 6 }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            height: 32, padding: "0 16px", borderRadius: "var(--radius-sm)", cursor: "pointer",
            fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", fontFamily: "var(--font-ui)",
            border: "1px solid " + (tab === t ? "var(--accent-primary-press)" : "transparent"),
            background: tab === t ? "var(--grad-select)" : "transparent",
            color: tab === t ? "var(--text-on-accent)" : "var(--text-on-dark-soft)",
            boxShadow: tab === t ? "var(--gloss-top-dark)" : "none",
          }}>{t}</button>
        ))}
      </nav>
      <div className="il-topbar-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        <span className="il-topbar-jobs" style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-sm)", color: "var(--text-on-dark-muted)" }}>{jobInfo}</span>
        <button onClick={onOpenSettings} title="Settings" style={{
          display: "flex", alignItems: "center", gap: 7, height: 32, padding: "0 12px",
          borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-on-dark)",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          fontSize: "var(--text-sm)", fontFamily: "var(--font-ui)",
        }}>
          <Icon name="prefs" size={15} color="var(--text-on-dark)" emboss={false} />
          <span className="il-settings-label">Settings</span>
        </button>
      </div>
    </header>
  );
}
