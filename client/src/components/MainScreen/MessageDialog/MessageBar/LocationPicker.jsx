import { useState, useRef, useEffect } from "react";
import { useToast } from "../../../ui/Toast";
import Spinner from "../../../ui/Spinner";

const DURATIONS = [
  { label: "15 minutes", ms: 15 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "8 hours", ms: 8 * 60 * 60 * 1000 },
];

export default function LocationPicker({ onSend, sharing }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDurations, setShowDurations] = useState(false);
  const ref = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
        setShowDurations(false);
      }
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
      onSend({ lat: pos.coords.latitude, lng: pos.coords.longitude, live: false });
      setOpen(false);
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
      onSend({ lat: pos.coords.latitude, lng: pos.coords.longitude, live: true, durationMs: ms });
      setOpen(false);
      setShowDurations(false);
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
        disabled={!!sharing}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Share location"
        title={sharing ? "Already sharing live location in this chat" : "Share location"}
        className="rounded-full p-1.5 h-fit text-gray-500 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 bottom-12 left-0 w-56 rounded-2xl shadow-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 text-sm">
          {loading ? (
            <div className="flex items-center justify-center py-4"><Spinner size="sm" /></div>
          ) : showDurations ? (
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
                onClick={() => setShowDurations(false)}
                className="w-full text-left px-2 py-2 rounded-lg text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              >Back</button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={sendCurrent}
                className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >📍 <span>Send current location</span></button>
              <button
                type="button"
                onClick={() => setShowDurations(true)}
                className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >🔴 <span>Share live location</span></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
