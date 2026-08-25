import { useState, useRef, useEffect } from "react";
import { useToast } from "../../../ui/Toast";
import Spinner from "../../../ui/Spinner";

const CATEGORIES = [
  { label: "Photos & Videos", icon: "🖼️", accept: "image/*,video/*" },
  { label: "Audio", icon: "🎵", accept: "audio/*" },
  { label: "Document", icon: "📄", accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" },
];

const DURATIONS = [
  { label: "15 minutes", ms: 15 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "8 hours", ms: 8 * 60 * 60 * 1000 },
];

export default function AttachMenu({ onPick, onSendLocation, sharingLiveLocation }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("menu"); // "menu" | "location" | "durations"
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const toast = useToast();

  const close = () => {
    setOpen(false);
    setView("menu");
  };

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) close();
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation isn't available in this browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
    });
  }

  async function sendCurrent() {
    setLoading(true);
    try {
      const pos = await getPosition();
      onSendLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, live: false });
      close();
    } catch (err) {
      toast.error("Couldn't get your location");
    } finally {
      setLoading(false);
    }
  }

  async function sendLive(ms) {
    setLoading(true);
    try {
      const pos = await getPosition();
      onSendLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, live: true, durationMs: ms });
      close();
    } catch (err) {
      toast.error("Couldn't get your location");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Attach"
        className="rounded-full p-1.5 h-fit hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
      >
        📎
      </button>
      {open && (
        <div className="absolute z-30 bottom-12 left-0 w-56 rounded-2xl shadow-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-1 text-sm">
          {loading ? (
            <div className="flex items-center justify-center py-4"><Spinner size="sm" /></div>
          ) : view === "durations" ? (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-gray-400">Share live location for</div>
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => sendLive(d.ms)}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                >{d.label}</button>
              ))}
              <button
                type="button"
                onClick={() => setView("location")}
                className="w-full text-left px-2 py-2 rounded-lg text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              >Back</button>
            </>
          ) : view === "location" ? (
            <>
              <button
                type="button"
                onClick={sendCurrent}
                className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >📍 <span>Send current location</span></button>
              <button
                type="button"
                disabled={!!sharingLiveLocation}
                title={sharingLiveLocation ? "Already sharing live location in this chat" : undefined}
                onClick={() => setView("durations")}
                className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"
              >🔴 <span>Share live location</span></button>
              <button
                type="button"
                onClick={() => setView("menu")}
                className="w-full text-left px-2 py-2 rounded-lg text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              >Back</button>
            </>
          ) : (
            <>
              {CATEGORIES.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    onPick(c.accept);
                    close();
                  }}
                  className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span className="text-lg leading-none">{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setView("location")}
                className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="text-lg leading-none">📍</span>
                <span>Location</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
