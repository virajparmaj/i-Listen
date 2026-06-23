import React from "react";
import { Checkbox } from "./ui/Checkbox.jsx";

export function AudioIssueFilters({ value = {}, onChange, compact = false }) {
  const set = (key, checked) => onChange?.({ ...value, [key]: checked });
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: compact ? 10 : 12,
      flexWrap: "wrap",
      fontFamily: "var(--font-typewriter)",
      fontSize: "var(--text-xs)",
    }}>
      <Checkbox checked={Boolean(value.bassCrackle)} onChange={(checked) => set("bassCrackle", checked)} label="Show Bass crackle" />
      <Checkbox checked={Boolean(value.leftChannel)} onChange={(checked) => set("leftChannel", checked)} label="Show Left channel issue" />
      <Checkbox checked={Boolean(value.needsRepair)} onChange={(checked) => set("needsRepair", checked)} label="Show Needs audio repair" />
    </div>
  );
}
