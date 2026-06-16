import React from "react";
import { Card } from "./ui/Card.jsx";
import { Badge } from "./ui/Badge.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";
import { IpodExplainer } from "./IpodExplainer.jsx";
import { IpodDevicePanel } from "./IpodDevicePanel.jsx";
import { PlaylistStructurePanel } from "./PlaylistStructurePanel.jsx";
import { ManualFallback } from "./ManualFallback.jsx";
import { SyncStatusBadge } from "./SyncStatusBadge.jsx";

const STEP_LABELS = [
  "Convert video to audio",
  "Edit metadata & artwork",
  "Export ready",
  "Add to Apple Music",
  "Sync iPod in Finder",
];

function Step({ index, label, tone, detail }) {
  return (
    <Card variant="recessed" style={{ padding: 12, display: "grid", gap: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 22, height: 22, borderRadius: "var(--radius-pill)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "var(--grad-graphite)", color: "var(--text-on-dark)",
          fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)",
        }}>{index}</span>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", lineHeight: 1.15 }}>{label}</span>
      </div>
      <Badge tone={tone}>{detail}</Badge>
    </Card>
  );
}

const finderSteps = [
  "Open Finder.",
  "Select Viraj Parmar’s iPod in the sidebar.",
  "Open the Music tab.",
  "Choose selected playlists.",
  "Tick iPod Sync.",
  "Click Apply/Sync.",
  "Eject the iPod before unplugging it.",
];

function FinderSyncChecklist({ count }) {
  if (!count) return null;
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <Icon name="done" size={16} color="var(--status-success)" />
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-body-lg)" }}>Finish in Finder</span>
        <span style={{ marginLeft: "auto" }}>
          <Badge tone="warning">{count} ready to sync</Badge>
        </span>
      </div>
      <ol style={{
        margin: 0,
        paddingLeft: 18,
        display: "grid",
        gap: 4,
        fontFamily: "var(--font-typewriter)",
        fontSize: "var(--text-xs)",
        color: "var(--text-secondary)",
        lineHeight: 1.5,
      }}>
        {finderSteps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <div style={{
        marginTop: 10,
        padding: "8px 10px",
        borderRadius: "var(--radius-sm)",
        background: "var(--status-warning-soft)",
        border: "1px solid var(--border-warning)",
        fontFamily: "var(--font-typewriter)",
        fontSize: "var(--text-xs)",
        color: "var(--text-warning-strong)",
        lineHeight: 1.45,
      }}>
        If Finder asks to Erase and Sync, pause before continuing.
      </div>
    </Card>
  );
}

function TrackRow({ track, onEdit, onApprove, approving }) {
  const metaTone = track.metadataStatus === "complete" ? "success" : "warning";
  const artTone = track.artworkStatus === "embedded" ? "success" : track.artworkStatus === "external" ? "info" : "warning";
  const approved = track.metadataReviewStatus === "approved";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      borderBottom: "1px solid var(--border-hairline)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "var(--radius-sm)", flexShrink: 0,
        background: track.coverArt ? `center/cover no-repeat url(${track.coverArt})` : "var(--surface-recessed)",
        border: "1px solid var(--border-hairline)",
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-medium)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
        <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {track.artist}{track.album ? ` · ${track.album}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        <Badge tone={metaTone}>{track.metadataStatus === "complete" ? "Tags ✓" : "Tags?"}</Badge>
        <Badge tone={artTone}>{track.artworkStatus === "missing" ? "No art" : "Art ✓"}</Badge>
        <SyncStatusBadge track={track} />
        <Button size="sm" variant="ghost" onClick={() => onEdit(track)}>Edit</Button>
        {!approved && (
          <Button size="sm" variant="secondary" disabled={approving} onClick={() => onApprove(track)}>
            {approving ? "Approving…" : "Approve"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Step 4 — integrated iPod Sync workflow screen. */
export function SyncView({ tracks, helper, ipod, actions, onShowToast, onEdit }) {
  const [busy, setBusy] = React.useState(false);
  const [approvingId, setApprovingId] = React.useState("");
  const [cleanupBusy, setCleanupBusy] = React.useState(false);
  const [blocked, setBlocked] = React.useState(null);
  const { refreshIpod } = actions;

  React.useEffect(() => {
    if (helper.connected) refreshIpod();
  }, [helper.connected, refreshIpod]);

  const complete = tracks.filter((t) => t.status === "complete");
  const needsReview = complete.filter((t) => t.metadataReviewStatus !== "approved");
  const approved = complete.filter((t) => t.metadataReviewStatus === "approved");
  const readyToHandoff = approved.filter((t) => t.outputPath && t.exportStatus !== "invalid");
  const pendingHandoff = readyToHandoff.filter((t) => t.appleMusicPlaylistStatus !== "added");
  const alreadyInPlaylist = readyToHandoff.filter((t) => t.appleMusicPlaylistStatus === "added");
  const needsFinderSync = alreadyInPlaylist.filter((t) => t.readyForFinderSync || t.syncState === "needs_manual");
  const metaIncomplete = complete.filter((t) => t.metadataStatus !== "complete" || t.artworkStatus === "missing" || t.metadataReviewStatus !== "approved");

  const steps = [
    complete.length ? { tone: "success", detail: `${complete.length} converted` } : { tone: "neutral", detail: "None yet" },
    metaIncomplete.length ? { tone: "warning", detail: `${metaIncomplete.length} need review` } : { tone: "success", detail: "Approved" },
    readyToHandoff.length ? { tone: "info", detail: `${readyToHandoff.length} ready` } : { tone: "neutral", detail: "None ready" },
    alreadyInPlaylist.length ? { tone: "success", detail: `${alreadyInPlaylist.length} in playlist` } : { tone: "neutral", detail: "Not added" },
    needsFinderSync.length ? { tone: "warning", detail: "Sync in Finder" } : { tone: "neutral", detail: "Waiting" },
  ];

  const onHandoff = async () => {
    if (!helper.connected) {
      onShowToast("Connect the local helper first.");
      return;
    }
    setBusy(true);
    try {
      const result = await actions.handoffToAppleMusic();
      if (result.blocked) {
        setBlocked(result);
        onShowToast(result.message);
      } else {
        setBlocked(null);
        const added = (result.results || []).filter((r) => r.importStatus === "imported").length;
        if (result.noop) onShowToast(result.message || "Nothing new to add; sync in Finder.");
        else onShowToast(`${added} track${added === 1 ? "" : "s"} ready in “${result.master}”.`);
      }
    } catch (error) {
      onShowToast(error.message);
    } finally {
      setBusy(false);
    }
  };

  const onApprove = async (track) => {
    if (!helper.connected) {
      onShowToast("Connect the local helper first.");
      return;
    }
    setApprovingId(track.id);
    try {
      const result = await actions.approveTrack(track);
      const failed = (result.results || []).find((item) => item.id === track.id && !item.ok);
      if (failed) onShowToast(failed.error || "Could not approve this track.");
      else onShowToast(`Approved ${track.artist} — ${track.title}.`);
    } catch (error) {
      onShowToast(error.message);
    } finally {
      setApprovingId("");
    }
  };

  const onCleanup = async () => {
    setCleanupBusy(true);
    try {
      const result = await actions.cleanupMusicPlaylists();
      const removed = result.removed || [];
      onShowToast(removed.length ? `Removed ${removed.length} old iPod playlist${removed.length === 1 ? "" : "s"}.` : "No old iPod playlists found.");
    } catch (error) {
      onShowToast(error.message);
    } finally {
      setCleanupBusy(false);
    }
  };

  return (
    <div className="il-sync-view" style={{ display: "grid", gap: 16, maxWidth: 1080, margin: "0 auto", padding: "4px 0 40px" }}>
      <IpodExplainer />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <IpodDevicePanel
          ipod={ipod}
          helperConnected={helper.connected}
          onRefresh={actions.refreshIpod}
          onSelect={actions.selectIpod}
          onShowToast={onShowToast}
        />
        <PlaylistStructurePanel tracks={tracks} />
      </div>

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Icon name="get" size={16} color="var(--accent-primary)" />
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-body-lg)" }}>Hand off to iPod</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Button
              variant="secondary"
              size="md"
              disabled={cleanupBusy || !helper.connected}
              onClick={onCleanup}
            >
              {cleanupBusy ? "Cleaning…" : "Clean old playlists"}
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={busy || !helper.connected || !pendingHandoff.length}
              onClick={onHandoff}
            >
              {busy ? "Adding…" : pendingHandoff.length ? `Add ${pendingHandoff.length} new/changed to Apple Music` : "Nothing new to add; sync in Finder"}
            </Button>
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {STEP_LABELS.map((label, i) => (
            <Step key={label} index={i + 1} label={label} tone={steps[i].tone} detail={steps[i].detail} />
          ))}
        </div>
      </Card>

      <ManualFallback blocked={blocked} onRetry={onHandoff} onShowToast={onShowToast} />
      <FinderSyncChecklist count={needsFinderSync.length} />

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-hairline)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-body-lg)" }}>Tracks</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Badge tone={needsReview.length ? "warning" : "success"}>{needsReview.length ? `${needsReview.length} need review` : `${approved.length} approved`}</Badge>
            <Badge tone="neutral">{complete.length} converted</Badge>
          </span>
        </div>
        {complete.length ? (
          complete.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onEdit={onEdit}
              onApprove={onApprove}
              approving={approvingId === track.id}
            />
          ))
        ) : (
          <div style={{ padding: 20, fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            No converted tracks yet. Convert some YouTube links first, then come back to sync.
          </div>
        )}
      </Card>
    </div>
  );
}
