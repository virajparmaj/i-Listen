import { addLog, listJobs, updateJob } from "./db.js";
import { buildMetadataContext } from "./metadataAi.js";
import { downloadCatalogArtwork, selectCatalogArtworkCandidate } from "./catalogArtwork.js";
import { retagExport } from "./retag.js";
import { refreshAppleMusicTracks } from "./appleMusic.js";

export function findAiArtworkRepairCandidates(jobs = [], ids = []) {
  const wanted = new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean));
  return (Array.isArray(jobs) ? jobs : []).filter((job) => {
    if (wanted.size && !wanted.has(job.id)) return false;
    return job.status === "complete"
      && job.outputPath
      && job.metadataReviewStatus === "approved"
      && job.aiMetadataStatus === "approved"
      && !job.customCoverPath;
  });
}

function resultForCandidate(job, context) {
  const candidate = selectCatalogArtworkCandidate({ metadata: job, context });
  if (!candidate) {
    return {
      id: job.id,
      title: job.title,
      artist: job.artist,
      ok: false,
      action: "dry-run",
      error: "Trusted catalog artwork was not found.",
    };
  }
  return {
    id: job.id,
    title: job.title,
    artist: job.artist,
    ok: true,
    action: "dry-run",
    source: candidate.source,
    artworkUrl: candidate.artworkUrl,
    candidateId: candidate.id || candidate.releaseId || "",
  };
}

export async function repairAiArtwork({
  db,
  project,
  tools,
  ids = [],
  apply = false,
  jobs = null,
  contextBuilder = buildMetadataContext,
  downloadArtwork = downloadCatalogArtwork,
  retag = retagExport,
  refreshMusicTracks = refreshAppleMusicTracks,
  fetchImpl = fetch,
  onLog = () => {},
} = {}) {
  const candidates = findAiArtworkRepairCandidates(jobs || listJobs(db), ids);
  const results = [];

  for (const job of candidates) {
    onLog(`${apply ? "Repairing" : "Checking"} ${job.artist} - ${job.title}`);
    const context = await contextBuilder(job, { tools, project, examples: [] });
    const preview = resultForCandidate(job, context);
    if (!preview.ok || !apply) {
      results.push(preview);
      continue;
    }

    if (!tools?.ffmpeg?.ok || !tools?.ffprobe?.ok) {
      const error = "ffmpeg and ffprobe are required to repair AI artwork.";
      updateJob(db, job.id, { metadataReviewStatus: "needs_review", lastError: error });
      results.push({ ...preview, ok: false, action: "repair", error });
      continue;
    }

    const artwork = await downloadArtwork({
      project,
      job,
      metadata: job,
      context,
      fetchImpl,
    });
    if (!artwork.ok) {
      updateJob(db, job.id, {
        metadataReviewStatus: "needs_review",
        aiMetadataStatus: "failed",
        aiMetadataError: artwork.error,
        lastError: artwork.error,
      });
      results.push({ ...preview, ok: false, action: "repair", error: artwork.error });
      continue;
    }

    const withArtwork = updateJob(db, job.id, {
      customCoverPath: artwork.path,
      artworkStatus: "external",
      lastError: "",
    });
    const retagged = await retag(tools, withArtwork);
    if (!retagged.ok) {
      updateJob(db, job.id, {
        exportStatus: "invalid",
        metadataReviewStatus: "needs_review",
        lastError: retagged.error,
      });
      results.push({ ...preview, ok: false, action: "repair", customCoverPath: artwork.path, error: retagged.error });
      continue;
    }

    const repaired = updateJob(db, job.id, {
      customCoverPath: artwork.path,
      exportStatus: "validated",
      metadataStatus: retagged.metadataStatus,
      artworkStatus: retagged.artworkStatus,
      durationSec: retagged.durationSec,
      sizeBytes: retagged.sizeBytes,
      appleMusicImportStatus: "pending",
      appleMusicPlaylistStatus: "pending",
      readyForFinderSync: 0,
      syncState: "",
      lastError: "",
    });

    let musicRefresh = null;
    if (repaired.musicPersistentId || repaired.appleMusicImportStatus === "imported" || job.appleMusicImportStatus === "imported") {
      try {
        musicRefresh = (await refreshMusicTracks([repaired]))[0] || null;
      } catch (error) {
        musicRefresh = { status: "failed", reason: error.message };
      }
    }

    addLog(db, `Repaired catalog artwork for ${repaired.artist} - ${repaired.title}.`, "ok", "Artwork:");
    results.push({
      ...preview,
      ok: true,
      action: "repair",
      customCoverPath: artwork.path,
      dimensions: artwork.dimensions || null,
      musicRefresh,
    });
  }

  return { apply, candidates: candidates.length, results };
}
