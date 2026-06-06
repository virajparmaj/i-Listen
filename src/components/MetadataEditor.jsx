import React from "react";
import { Modal } from "./ui/Modal.jsx";
import { Input } from "./ui/Input.jsx";
import { Select } from "./ui/Select.jsx";
import { Button } from "./ui/Button.jsx";
import { GENRES, FORMAT_OPTIONS, PRESETS } from "../data/mockData.js";
import { CoverArtUploader } from "./CoverArtUploader.jsx";

function Field({ label, children, span = 1 }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: `span ${span}` }}>
      <span className="il-label">{label}</span>
      {children}
    </label>
  );
}

const presetOptions = PRESETS.map((p) => ({ value: p.id, label: p.name }));

/** Per-track metadata editor with embedded cover-art uploader. */
export function MetadataEditor({ open, track, onClose, onSave }) {
  const [draft, setDraft] = React.useState(track);
  React.useEffect(() => setDraft(track), [track]);
  if (!track || !draft) return null;

  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });
  const genreOpts = GENRES.map((g) => ({ value: g, label: g }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Metadata — ${track.title}`}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave(track.id, draft)}>Save changes</Button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 20 }}>
        <div>
          <CoverArtUploader value={draft.coverArt} onChange={(d) => setDraft({ ...draft, coverArt: d })} compact />
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Output format">
              <Select value={draft.format} onChange={set("format")} options={FORMAT_OPTIONS} style={{ width: "100%" }} />
            </Field>
            <Field label="Quality preset">
              <Select value={draft.preset} onChange={set("preset")} options={presetOptions} style={{ width: "100%" }} />
            </Field>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignContent: "start" }}>
          <Field label="Title" span={2}><Input value={draft.title} onChange={set("title")} /></Field>
          <Field label="Artist"><Input value={draft.artist} onChange={set("artist")} /></Field>
          <Field label="Album Artist"><Input value={draft.albumArtist} onChange={set("albumArtist")} /></Field>
          <Field label="Album"><Input value={draft.album} onChange={set("album")} /></Field>
          <Field label="Year"><Input value={draft.year} onChange={set("year")} /></Field>
          <Field label="Genre"><Select value={draft.genre} onChange={set("genre")} options={genreOpts} style={{ width: "100%" }} /></Field>
          <Field label="Track #"><Input value={draft.track} onChange={set("track")} /></Field>
          <Field label="Composer"><Input value={draft.composer} onChange={set("composer")} /></Field>
          <Field label="Producer"><Input value={draft.producer} onChange={set("producer")} /></Field>
          <Field label="Version label" span={2}><Input value={draft.versionLabel} onChange={set("versionLabel")} placeholder="e.g. Remaster, Radio Edit" /></Field>
          <Field label="Comment" span={2}>
            <textarea value={draft.comment} onChange={set("comment")} rows={2} style={{
              resize: "vertical", padding: "8px 12px", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-hairline)", background: "var(--surface-panel)",
              boxShadow: "var(--shadow-inset)", fontFamily: "var(--font-ui)", fontSize: "var(--text-body)",
              color: "var(--text-primary)", outline: "none",
            }} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
