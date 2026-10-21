import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const textTypes = new Set(["text/plain", "text/csv"]);

export default function DocumentPreview({ src, name, contentType, size, onDownload }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const isPdf = contentType === "application/pdf";
  const isText = textTypes.has(contentType);

  useEffect(() => {
    if (!open || !isText) return;
    let active = true;
    setError("");
    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error("Preview request failed");
        return response.text();
      })
      .then((value) => {
        if (active) setText(value.slice(0, 12000));
      })
      .catch(() => {
        if (active) setError("Preview unavailable");
      });
    return () => { active = false; };
  }, [open, isText, src]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="document-card">
      <div className="flex items-center gap-3">
        <span className="document-icon" aria-hidden="true">▤</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{name || "Document"}</span>
          <span className="block text-xs text-[var(--text-muted)]">
            {isPdf ? "PDF preview available" : isText ? "Text preview available" : "Document"}
          </span>
        </span>
        <div className="document-card-actions">
          {(isPdf || isText) && (
            <button type="button" className="document-icon-button" title="Preview document" aria-label="Preview document" onClick={() => setOpen(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
            </button>
          )}
          <button type="button" className="document-icon-button" title={`Download${size ? ` · ${size}` : ""}`} aria-label={`Download document${size ? `, ${size}` : ""}`} onClick={onDownload}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v3h16v-3" /></svg>
          </button>
        </div>
      </div>
      {open && createPortal(
        <div className="document-preview-modal" role="dialog" aria-modal="true" aria-label={`${name || "Document"} preview`}>
          <button type="button" className="document-preview-backdrop" aria-label="Close preview" onClick={() => setOpen(false)} />
          <div className="document-preview-window">
            <div className="document-preview-header">
              <span className="truncate font-semibold">{name || "Document"}</span>
              <button type="button" className="document-preview-close" onClick={() => setOpen(false)} aria-label="Close preview">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            {isPdf && <iframe title={`${name || "Document"} preview`} src={src} className="document-preview-frame" />}
            {isText && <pre className="document-preview-text">{error || text || "Loading preview…"}</pre>}
          </div>
        </div>
      , document.body)}
    </div>
  );
}
