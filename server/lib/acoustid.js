import { runProcess } from "./converter.js";
import { rankMusicBrainzRecordings } from "./musicBrainz.js";

const ACOUSTID_URL = "https://api.acoustid.org/v2/lookup";

async function fingerprintAudio(outputPath, { fpcalcPath, run = runProcess } = {}) {
  if (!fpcalcPath) return null;
  const { stdout } = await run(fpcalcPath, ["-json", outputPath]);
  const parsed = JSON.parse(stdout || "{}");
  if (!parsed.fingerprint || !Number.isFinite(parsed.duration)) return null;
  return {
    fingerprint: parsed.fingerprint,
    duration: Math.round(parsed.duration),
  };
}

function recordingsFromAcoustId(data = {}) {
  const results = Array.isArray(data.results) ? data.results : [];
  return results
    .filter((result) => Number(result.score || 0) > 0)
    .flatMap((result) => Array.isArray(result.recordings)
      ? result.recordings.map((recording) => ({ ...recording, acoustidScore: Number(result.score || 0) }))
      : []);
}

export async function lookupAcoustId(job, {
  clientKey = process.env.ILISTEN_ACOUSTID_CLIENT_KEY || "",
  fpcalcPath,
  fetchImpl = fetch,
  run,
} = {}) {
  if (!clientKey || !fpcalcPath || !job?.outputPath) {
    return { candidates: [], skipped: true };
  }

  try {
    const fingerprint = await fingerprintAudio(job.outputPath, { fpcalcPath, run });
    if (!fingerprint) return { candidates: [], error: "Could not fingerprint audio." };

    const url = new URL(ACOUSTID_URL);
    url.searchParams.set("client", clientKey);
    url.searchParams.set("duration", String(fingerprint.duration));
    url.searchParams.set("fingerprint", fingerprint.fingerprint);
    url.searchParams.set("format", "json");
    url.searchParams.set("meta", "recordings releases releasegroups tracks");

    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`AcoustID returned ${response.status}`);
    const data = await response.json();
    return {
      candidates: rankMusicBrainzRecordings(recordingsFromAcoustId(data), job)
        .map((candidate) => ({ ...candidate, source: "acoustid" })),
    };
  } catch (error) {
    return { candidates: [], error: error.message };
  }
}
