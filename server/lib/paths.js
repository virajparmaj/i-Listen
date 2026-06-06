import { accessSync, constants, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export const PROJECT_FOLDERS = ["staging", "exports", "artwork", "logs"];
export const DEFAULT_PROJECT_PATH = join(homedir(), "Music", "iListen Project");

export function expandHome(value) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_PROJECT_PATH;
  if (raw === "~") return homedir();
  if (raw.startsWith("~/")) return join(homedir(), raw.slice(2));
  return raw;
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function ensureProject(projectPath = DEFAULT_PROJECT_PATH) {
  const root = resolve(expandHome(projectPath));
  ensureDir(root);
  PROJECT_FOLDERS.forEach((folder) => ensureDir(join(root, folder)));
  return {
    root,
    dbPath: join(root, "ilisten.sqlite"),
    stagingDir: join(root, "staging"),
    exportsDir: join(root, "exports"),
    artworkDir: join(root, "artwork"),
    logsDir: join(root, "logs"),
  };
}

export function assertReadableExecutable(path) {
  accessSync(path, constants.R_OK | constants.X_OK);
  return path;
}

export function fileExists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function sanitizePathSegment(value, fallback = "Untitled") {
  const cleaned = String(value ?? "")
    .replace(FORBIDDEN_FILENAME_CHARS, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[-. ]+$/g, "");

  if (!cleaned || RESERVED_WINDOWS_NAMES.test(cleaned)) return fallback;
  return cleaned;
}

export function ensureParent(path) {
  ensureDir(dirname(path));
  return path;
}

export function relativePlaylistPath(outputPath) {
  return outputPath.replaceAll("\\", "/");
}
