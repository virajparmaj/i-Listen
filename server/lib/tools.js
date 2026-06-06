import { spawnSync } from "node:child_process";
import { assertReadableExecutable } from "./paths.js";

const TOOL_ENV = {
  ytdlp: "ILISTEN_YTDLP",
  ffmpeg: "ILISTEN_FFMPEG",
  ffprobe: "ILISTEN_FFPROBE",
};

const TOOL_COMMANDS = {
  ytdlp: ["yt-dlp"],
  ffmpeg: ["ffmpeg"],
  ffprobe: ["ffprobe"],
};

function commandVersion(path, args) {
  const result = spawnSync(path, args, { encoding: "utf8", timeout: 5000 });
  if (result.error) return null;
  const text = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return text.split(/\n/)[0] || null;
}

function which(command) {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function resolveTool(name) {
  const envPath = process.env[TOOL_ENV[name]];
  if (envPath) {
    try {
      assertReadableExecutable(envPath);
      return {
        ok: true,
        name,
        path: envPath,
        source: "env",
        version: commandVersion(envPath, name === "ytdlp" ? ["--version"] : ["-version"]),
      };
    } catch (error) {
      return { ok: false, name, path: envPath, source: "env", error: error.message };
    }
  }

  for (const command of TOOL_COMMANDS[name]) {
    const path = which(command);
    if (path) {
      return {
        ok: true,
        name,
        path,
        source: "path",
        version: commandVersion(path, name === "ytdlp" ? ["--version"] : ["-version"]),
      };
    }
  }

  return {
    ok: false,
    name,
    path: null,
    source: "missing",
    error: `Install ${TOOL_COMMANDS[name][0]} or set ${TOOL_ENV[name]}.`,
  };
}

export function detectTools() {
  const tools = {
    ytdlp: resolveTool("ytdlp"),
    ffmpeg: resolveTool("ffmpeg"),
    ffprobe: resolveTool("ffprobe"),
  };

  return {
    ...tools,
    ready: tools.ytdlp.ok && tools.ffmpeg.ok && tools.ffprobe.ok,
  };
}
