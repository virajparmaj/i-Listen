import React from "react";
import { Card } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Icon } from "./ui/Icon.jsx";
import { filenameFor } from "../utils/download.js";

function CoverTile({ track }) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{
        aspectRatio: "1 / 1", borderRadius: "var(--radius-sm)", overflow: "hidden",
        border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card)",
        background: track.coverArt ? `center/cover no-repeat url(${track.coverArt})` : track.thumbColor,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!track.coverArt && <Icon name="note" size={30} color="rgba(255,255,255,0.92)" emboss={false} />}
      </div>
      <div style={{ marginTop: 8, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.title}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.artist} · {track.format.toUpperCase()}</div>
    </div>
  );
}

function FolderTree({ tracks, pattern }) {
  const byArtist = {};
  tracks.forEach((t) => (byArtist[t.artist] = byArtist[t.artist] || {}));
  tracks.forEach((t) => {
    byArtist[t.artist][t.album] = byArtist[t.artist][t.album] || [];
    byArtist[t.artist][t.album].push(t);
  });
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.7 }}>
      <div style={{ color: "var(--text-primary)" }}>Music Library/</div>
      {Object.entries(byArtist).map(([artist, albums]) => (
        <div key={artist}>
          <div style={{ paddingLeft: 16 }}>{artist}/</div>
          {Object.entries(albums).map(([album, items]) => (
            <div key={album}>
              <div style={{ paddingLeft: 32 }}>{album}/</div>
              {items.map((t) => (
                <div key={t.id} style={{ paddingLeft: 48 }}>{filenameFor(t, pattern)}</div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function LibraryView({ tracks, pattern, onZip, onCSV }) {
  const done = tracks.filter((t) => t.status === "complete");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 18px", borderBottom: "1px solid var(--border-soft)", background: "var(--grad-chrome)" }}>
          <Icon name="note" size={18} />
          <span style={{ fontWeight: 600 }}>Converted library</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{done.length} tracks</span>
        </div>
        {done.length === 0 ? (
          <div style={{ padding: "48px 18px", textAlign: "center", color: "var(--text-secondary)" }}>
            <Icon name="note" size={30} color="var(--border-strong)" style={{ margin: "0 auto 10px" }} />
            <div>No converted tracks yet.</div>
            <div style={{ fontSize: "var(--text-sm)" }}>Convert some tracks to build your library.</div>
          </div>
        ) : (
          <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))", gap: 16 }}>
            {done.map((t) => <CoverTile key={t.id} track={t} />)}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <div className="il-label" style={{ marginBottom: 10 }}>Folder structure</div>
          {done.length ? <FolderTree tracks={done} pattern={pattern} /> : <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Nothing converted yet.</div>}
        </Card>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button variant="primary" fullWidth disabled={!done.length} iconLeft={<Icon name="zip" size={14} color="#fff" emboss={false} />} onClick={onZip}>Download organized library</Button>
            <Button variant="ghost" fullWidth iconLeft={<Icon name="csv" size={14} />} onClick={onCSV} disabled={!done.length}>Export CSV report</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
