import { useRef, useState, useEffect, useMemo } from "react";

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Deterministic pseudo-waveform so the same message always looks the same,
// without needing to actually decode/analyze the audio.
function makeBars(seed, count) {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
  const bars = [];
  for (let i = 0; i < count; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    const wobble = Math.sin(i * 0.7) * 0.3;
    bars.push(0.25 + Math.abs(((x >>> 16) % 100) / 100) * 0.55 + wobble * 0.2);
  }
  return bars;
}

export default function VoiceNote({ src }) {
  const audioRef = useRef(null);
  const barsRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const bars = useMemo(() => makeBars(src || "", 34), [src]);

  useEffect(() => {
    const audio = audioRef.current;
    const onTime = () => setCurrent(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const seekToClientX = (clientX) => {
    if (!barsRef.current || !duration) return;
    const rect = barsRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const value = ratio * duration;
    audioRef.current.currentTime = value;
    setCurrent(value);
  };

  const progress = duration ? current / duration : 0;

  return (
    <div className="flex items-center gap-2.5 w-56 px-2.5 py-2 rounded-2xl bg-black/5 dark:bg-white/10">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="w-9 h-9 shrink-0 rounded-full bg-[var(--accent)] text-white flex items-center justify-center active:scale-95 transition-transform shadow-sm"
      >
        {playing ? (
          <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><rect width="3" height="12" /><rect x="7" width="3" height="12" /></svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><polygon points="0,0 12,6 0,12" /></svg>
        )}
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div
          ref={barsRef}
          onClick={(e) => seekToClientX(e.clientX)}
          className="flex items-center gap-[2.5px] h-6 cursor-pointer"
        >
          {bars.map((h, i) => {
            const played = bars.length ? i / bars.length < progress : false;
            return (
              <span
                key={i}
                className={`flex-1 min-w-[2px] rounded-full transition-colors ${played ? "bg-[var(--accent)]" : "bg-black/20 dark:bg-white/25"}`}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            );
          })}
        </div>
        <span className="text-[0.7rem] text-gray-500 dark:text-gray-400 tabular-nums">
          {formatTime(playing || current ? current : duration)}
        </span>
      </div>
    </div>
  );
}
