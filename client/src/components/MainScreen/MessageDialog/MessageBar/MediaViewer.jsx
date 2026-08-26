import { useEffect } from "react";
import close from "/close.svg";
import download from "/down.svg";
import { downloadFile } from "../../../../download";
import { useToast } from "../../../ui/Toast";

// Full-screen preview for an image/video/PDF attachment - clicking the small
// inline thumbnail/player in Message.jsx opens this instead of navigating
// away to a bare browser tab (images) or leaving video stuck at its tiny
// inline size with no bigger "theater" view.
export default function MediaViewer({ item, onClose }) {
  const toast = useToast();

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/85 z-40 flex items-center justify-center animate-fade-in"
    >
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); downloadFile(item.src, item.name).catch(() => toast.error("Couldn't download file")); }}
          aria-label="Download"
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          <img src={download} className="w-4 h-4 invert" alt="" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          <img src={close} className="w-4 h-4 invert" alt="" />
        </button>
      </div>

      <div onClick={(e) => e.stopPropagation()} className="max-w-[92vw] max-h-[88vh] flex flex-col items-center">
        {item.type === "image" && (
          <img src={item.src} alt={item.name} className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg" />
        )}
        {item.type === "video" && (
          <video src={item.src} controls autoPlay className="max-w-[92vw] max-h-[88vh] rounded-lg" />
        )}
        {item.type === "pdf" && (
          <iframe title={item.name} src={item.src} className="w-[85vw] h-[85vh] bg-white rounded-lg" />
        )}
        <div className="mt-2 text-white/70 text-xs truncate max-w-full">{item.name}</div>
      </div>
    </div>
  );
}
