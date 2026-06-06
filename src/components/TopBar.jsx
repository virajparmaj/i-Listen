import React from "react";
import { Icon } from "./ui/Icon.jsx";

const ClickWheelMark = () => (
  <span style={{
    width: 30, height: 30, borderRadius: "50%", flex: "none",
    background: "radial-gradient(circle at 50% 35%, #FCFCFB 0%, #DCDCD8 60%, #BEBEB9 100%)",
    border: "1px solid #9a9a96",
    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <span style={{ width: 11, height: 11, borderRadius: "50%", background: "radial-gradient(circle at 50% 35%, #F2F2F1, #CFCFCA)", border: "1px solid #adada8" }} />
  </span>
);

export function TopBar({ tab, setTab, onOpenSettings, jobInfo }) {
  const tabs = ["Convert", "Library"];
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 16, padding: "0 20px", height: 56,
      background: "var(--grad-graphite)", borderBottom: "1px solid #1c1c1e",
      boxShadow: "var(--gloss-top-dark)", color: "var(--text-on-dark)",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <ClickWheelMark />
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
          <span style={{ color: "var(--ipod-lcd)" }}>i</span>Listen
        </span>
      </div>
      <nav style={{ display: "flex", gap: 4, marginLeft: 6 }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            height: 32, padding: "0 16px", borderRadius: "var(--radius-sm)", cursor: "pointer",
            fontSize: "var(--text-sm)", fontWeight: 500, fontFamily: "var(--font-ui)",
            border: "1px solid " + (tab === t ? "var(--accent-primary-press)" : "transparent"),
            background: tab === t ? "var(--grad-select)" : "transparent",
            color: tab === t ? "#fff" : "#c7c7cb",
            boxShadow: tab === t ? "var(--gloss-top-dark)" : "none",
          }}>{t}</button>
        ))}
      </nav>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "#a9a9ad" }}>{jobInfo}</span>
        <button onClick={onOpenSettings} title="Settings" style={{
          display: "flex", alignItems: "center", gap: 7, height: 32, padding: "0 12px",
          borderRadius: "var(--radius-sm)", cursor: "pointer", color: "#e6e6e8",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          fontSize: "var(--text-sm)", fontFamily: "var(--font-ui)",
        }}>
          <Icon name="prefs" size={15} color="#e6e6e8" emboss={false} />
          Settings
        </button>
      </div>
    </header>
  );
}
