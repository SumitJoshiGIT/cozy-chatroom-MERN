import { useRef, useState, useEffect } from "react";

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceNote({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

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

  const seek = (event) => {
    const value = Number(event.target.value);
    audioRef.current.currentTime = value;
    setCurrent(value);
  };

  return (
    <div className="flex items-center gap-2 w-52 px-2 py-1.5 rounded-lg bg-black/5 dark:bg-white/10">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="w-8 h-8 shrink-0 rounded-full bg-[var(--accent)] text-white flex items-center justify-center active:scale-95 transition-transform"
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect width="3" height="12" /><rect x="7" width="3" height="12" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="0,0 12,6 0,12" /></svg>
        )}
      </button>
      <input
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={current}
        onChange={seek}
        className="flex-1 accent-[var(--accent)] h-1"
      />
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
        {formatTime(playing || current ? current : duration)}
      </span>
    </div>
  );
}
