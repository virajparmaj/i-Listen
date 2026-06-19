import { IN_FLIGHT } from "../data/mockData.js";

const IN_FLIGHT_SET = new Set(IN_FLIGHT);

function timeValue(track = {}) {
  const value = track.createdAt || track.updatedAt || "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isComplete(track) {
  return track.status === "complete";
}

function isApproved(track) {
  return track.metadataReviewStatus === "approved";
}

function needsAppleMusicHandoff(track) {
  return isComplete(track)
    && isApproved(track)
    && track.outputPath
    && track.exportStatus !== "invalid"
    && track.appleMusicPlaylistStatus !== "added";
}

function needsFinderSync(track) {
  return isComplete(track)
    && isApproved(track)
    && track.appleMusicPlaylistStatus === "added"
    && (track.readyForFinderSync || track.syncState === "needs_manual");
}

function queuePriority(track) {
  if (IN_FLIGHT_SET.has(track.status)) return 0;
  if (track.status === "queued") return 1;
  if (track.status === "failed") return 2;
  if (track.status === "canceled") return 3;
  if (isComplete(track) && !isApproved(track)) return 4;
  if (needsAppleMusicHandoff(track)) return 5;
  if (track.status === "skipped") return 6;
  return 7;
}

function syncPriority(track) {
  if (track.aiMetadataStatus === "running") return 0;
  if (isComplete(track) && !isApproved(track)) return 1;
  if (needsAppleMusicHandoff(track)) return 2;
  if (needsFinderSync(track)) return 3;
  return 4;
}

function sortByPriorityThenNewest(tracks, priorityForTrack) {
  return [...tracks]
    .map((track, index) => ({ track, index }))
    .sort((a, b) => {
      const priorityDelta = priorityForTrack(a.track) - priorityForTrack(b.track);
      if (priorityDelta) return priorityDelta;

      const timeDelta = timeValue(b.track) - timeValue(a.track);
      if (timeDelta) return timeDelta;

      return b.index - a.index;
    })
    .map(({ track }) => track);
}

export function sortForConversionQueue(tracks = []) {
  return sortByPriorityThenNewest(tracks, queuePriority);
}

export function sortForSyncTracks(tracks = []) {
  return sortByPriorityThenNewest(tracks, syncPriority);
}
