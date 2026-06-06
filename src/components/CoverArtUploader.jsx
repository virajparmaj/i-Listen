import React from "react";
import { Icon } from "./ui/Icon.jsx";
import { Switch } from "./ui/Switch.jsx";

// Read a File -> dataURL, optionally downscale to a square and/or re-encode as JPEG.
function processImage(file, { resize, toJpeg }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!resize && !toJpeg) return resolve(reader.result);
      const img = new Image();
      img.onload = () => {
        const target = resize ? 800 : Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        const size = Math.min(target, Math.max(img.width, img.height));
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        // center-crop to square
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL(toJpeg ? "image/jpeg" : "image/png", 0.9));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Drag-and-drop cover-art uploader with resize + PNG→JPEG options. */
export function CoverArtUploader({ value, onChange, compact = false }) {
  const [drag, setDrag] = React.useState(false);
  const [resize, setResize] = React.useState(true);
  const [toJpeg, setToJpeg] = React.useState(true);
  const inputRef = React.useRef(null);

  const handleFiles = async (files) => {
    const file = [...files].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    const data = await processImage(file, { resize, toJpeg });
    onChange(data);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        style={{
          display: "flex", flexDirection: compact ? "row" : "column", alignItems: "center", justifyContent: "center",
          gap: 12, cursor: "pointer", textAlign: "center",
          padding: compact ? 12 : 20,
          minHeight: compact ? 0 : 150,
          borderRadius: "var(--radius-md)",
          border: `1.5px dashed ${drag ? "var(--accent-primary)" : "var(--border-strong)"}`,
          background: drag ? "var(--surface-lcd)" : "var(--surface-recessed)",
          transition: "border-color 120ms ease, background 120ms ease",
        }}
      >
        <div style={{
          width: compact ? 56 : 84, height: compact ? 56 : 84, flex: "none", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-inset)", overflow: "hidden",
          background: value ? `center/cover no-repeat url(${value})` : "var(--surface-panel)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {!value && <Icon name="art" size={compact ? 22 : 30} color="var(--border-strong)" />}
        </div>
        <div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 600 }}>
            {value ? "Replace cover art" : "Drag & drop artwork"}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 2 }}>
            JPEG/PNG · square 600×600–1000×1000 px
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {!compact && (
        <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
          <Switch checked={resize} onChange={setResize} label="Resize to 800×800" />
          <Switch checked={toJpeg} onChange={setToJpeg} label="Convert PNG → JPEG" />
        </div>
      )}
    </div>
  );
}
