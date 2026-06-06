import React from "react";

/** Classic-OS modal window: pinstripe-dimmed backdrop, title bar with traffic lights. */
export function Modal({ open, onClose, title = "", width = 560, children, footer = null }) {
  const dialogRef = React.useRef(null);
  const titleId = React.useId();
  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    dialogRef.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  if (!open) return null;
  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(40,40,42,0.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="il-fade-in"
        style={{
          width,
          maxWidth: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-recessed)",
          border: "1px solid #8A8A86",
          borderRadius: 9,
          boxShadow: "var(--shadow-float), inset 0 1px 0 rgba(255,255,255,0.9)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 30,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 12px",
            background: "linear-gradient(180deg, #EFEFEC 0%, #CFCFCA 100%)",
            borderBottom: "1px solid #9A9A96",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
            flex: "none",
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ width: 13, height: 13, padding: 0, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.28)", background: "radial-gradient(circle at 35% 30%, #FF8A80, #D64A3F)", cursor: "pointer" }}
          />
          <span style={{ width: 13, height: 13, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.28)", background: "radial-gradient(circle at 35% 30%, #FFE08A, #D9A521)" }} />
          <span style={{ width: 13, height: 13, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.28)", background: "radial-gradient(circle at 35% 30%, #B6E88A, #5F9A3F)" }} />
          <span id={titleId} style={{ margin: "0 auto", fontSize: "var(--text-sm)", fontWeight: 600, color: "#4A4A48", textShadow: "0 1px 0 rgba(255,255,255,0.7)" }}>{title}</span>
        </div>
        <div className="il-scroll" style={{ padding: 22, overflow: "auto", background: "linear-gradient(180deg, #FBFBF9 0%, #F1F1ED 100%)" }}>
          {children}
        </div>
        {footer && (
          <div
            className="il-modal-footer"
            style={{
              padding: "12px 18px",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 10,
              borderTop: "1px solid var(--border-soft)",
              background: "var(--surface-recessed)",
              flex: "none",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
