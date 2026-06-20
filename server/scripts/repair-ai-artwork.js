import { resolve } from "node:path";
import { openDatabase } from "../lib/db.js";
import { repairAiArtwork } from "../lib/aiArtworkRepair.js";
import { DEFAULT_PROJECT_PATH, ensureProject } from "../lib/paths.js";
import { detectTools } from "../lib/tools.js";

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  return process.argv[index + 1] || "";
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseIds(value) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

const projectPath = resolve(argValue("--project") || process.env.ILISTEN_PROJECT || DEFAULT_PROJECT_PATH);
const project = ensureProject(projectPath);
const db = openDatabase(project.dbPath);
const apply = hasFlag("--apply");
const ids = parseIds(argValue("--ids"));

try {
  const result = await repairAiArtwork({
    db,
    project,
    tools: detectTools(),
    ids,
    apply,
    onLog: (message) => console.log(message),
  });

  console.log(`${apply ? "Repair" : "Dry run"} complete: ${result.candidates} candidate${result.candidates === 1 ? "" : "s"}.`);
  for (const item of result.results) {
    const status = item.ok ? "OK" : "BLOCKED";
    const detail = item.ok
      ? `${item.source || "catalog"} ${item.artworkUrl || item.customCoverPath || ""}`.trim()
      : item.error;
    console.log(`${status}\t${item.id}\t${item.artist} - ${item.title}\t${detail}`);
    if (item.musicRefresh?.status === "failed") {
      console.log(`WARN\t${item.id}\tApple Music refresh failed: ${item.musicRefresh.reason}`);
    }
  }

  if (!apply && result.candidates) {
    console.log("Run again with --apply to save catalog art, retag files, and refresh Apple Music rows.");
  }
} finally {
  db.close();
}
