import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pin = L.divIcon({
  html: '<div style="font-size:28px;line-height:1;transform:translate(-50%,-90%)">📍</div>',
  className: "",
  iconSize: [0, 0],
});

function formatUntil(expiresAt) {
  if (!expiresAt) return "";
  const d = new Date(expiresAt);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function LocationMessage({ location, flag, onStop }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const [expired, setExpired] = useState(location.live && location.expiresAt && new Date(location.expiresAt) < new Date());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [location.lat, location.lng],
      zoom: 15,
      scrollWheelZoom: false,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    markerRef.current = L.marker([location.lat, location.lng], { icon: pin }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([location.lat, location.lng]);
    mapRef.current.panTo([location.lat, location.lng]);
  }, [location.lat, location.lng]);

  useEffect(() => {
    if (!location.live || !location.expiresAt) return;
    const ms = new Date(location.expiresAt).getTime() - Date.now();
    if (ms <= 0) { setExpired(true); return; }
    const timer = setTimeout(() => setExpired(true), ms);
    return () => clearTimeout(timer);
  }, [location.live, location.expiresAt]);

  const isLive = location.live && !expired;
  const mapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`;

  return (
    <div className="w-56 rounded-lg overflow-hidden shadow-sm border border-black/5 dark:border-white/10">
      <a href={mapsUrl} target="_blank" rel="noreferrer" title="Open in Maps" className="block">
        <div ref={containerRef} className="w-56 h-36" />
      </a>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-black/5 dark:bg-white/10 text-xs">
        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
          {isLive ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              Live until {formatUntil(location.expiresAt)}
            </>
          ) : location.live ? (
            "Live location ended"
          ) : (
            "Location"
          )}
        </span>
        {isLive && flag && (
          <button
            type="button"
            onClick={onStop}
            className="text-[var(--accent-dark)] font-semibold shrink-0"
          >Stop</button>
        )}
      </div>
    </div>
  );
}
