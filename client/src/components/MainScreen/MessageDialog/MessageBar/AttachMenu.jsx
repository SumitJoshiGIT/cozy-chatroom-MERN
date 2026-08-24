import { useState, useRef, useEffect } from "react";

const CATEGORIES = [
  { label: "Photos & Videos", icon: "🖼️", accept: "image/*,video/*" },
  { label: "Audio", icon: "🎵", accept: "audio/*" },
  { label: "Document", icon: "📄", accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" },
];

export default function AttachMenu({ onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Attach file"
        className="rounded-full p-1.5 h-fit hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
      >
        📎
      </button>
      {open && (
        <div className="absolute z-30 bottom-12 left-0 w-48 rounded-2xl shadow-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-1 text-sm">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => {
                onPick(c.accept);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span className="text-lg leading-none">{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
