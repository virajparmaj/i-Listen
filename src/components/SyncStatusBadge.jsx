import React from "react";
import { Badge } from "./ui/Badge.jsx";

/**
 * Map a track's pipeline state to a single plain-language sync status.
 * @param {object} track
 * @returns {{ label: string, tone: "neutral"|"info"|"success"|"warning"|"error" }}
 */
export function syncStatusOf(track) {
  if (track.lastError) return { label: "Failed — see logs", tone: "error" };
  if (track.appleMusicPlaylistStatus === "added") return { label: "Ready for Finder sync", tone: "success" };
  if (track.appleMusicImportStatus === "imported") return { label: "Added to Apple Music", tone: "info" };
  if (track.readyForFinderSync) return { label: "Needs manual sync", tone: "warning" };
  if (track.status === "complete" && track.metadataReviewStatus !== "approved") return { label: "Needs metadata review", tone: "warning" };
  if (track.status === "complete" && track.metadataReviewStatus === "approved") return { label: "Ready to add", tone: "success" };
  if (track.status === "complete" && track.exportStatus === "validated") return { label: "Exported", tone: "info" };
  if (track.status === "complete") return { label: "Ready for export", tone: "neutral" };
  return { label: "Not converted", tone: "neutral" };
}

export function SyncStatusBadge({ track }) {
  const { label, tone } = syncStatusOf(track);
  return <Badge tone={tone}>{label}</Badge>;
}
