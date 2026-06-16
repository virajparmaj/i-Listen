import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Best-effort structured log appended to a file under the project's logs/ dir.
 * Used for operations the user may need to debug outside the app (Apple Music
 * TCC prompts, iPod detection). Never throws.
 *
 * @param {{ logsDir?: string } | null} project
 * @param {string} fileName e.g. "applemusic.log"
 * @param {string} line
 */
export async function appendFileLog(project, fileName, line) {
  if (!project?.logsDir) return;
  try {
    await mkdir(project.logsDir, { recursive: true });
    await appendFile(join(project.logsDir, fileName), `${new Date().toISOString()} ${line}\n`, "utf8");
  } catch {
    // disk logging is best-effort; ignore failures
  }
}
