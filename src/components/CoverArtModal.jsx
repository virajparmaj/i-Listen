import React from "react";
import { Modal } from "./ui/Modal.jsx";
import { Button } from "./ui/Button.jsx";
import { CoverArtUploader } from "./CoverArtUploader.jsx";

/** Global cover-art modal — applies one image to every track. */
export function CoverArtModal({ open, value, onClose, onApply, resizeArtwork = true }) {
  const [art, setArt] = React.useState(value);
  React.useEffect(() => setArt(value), [value, open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cover art — all tracks"
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!art} onClick={() => onApply(art)}>Apply to all</Button>
        </>
      }
    >
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "0 0 14px", lineHeight: "var(--leading-snug)" }}>
        Embedded JPEG cover art is applied to every track. For per-track artwork, open a track's metadata editor instead.
      </p>
      <CoverArtUploader value={art} onChange={setArt} defaultResize={resizeArtwork} />
    </Modal>
  );
}
