import { apiOrigin } from "./apiOrigin";

const STORAGE_KEY = "lavender-push-enabled";

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getStoredPushPreference() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

// VAPID keys are handed to pushManager.subscribe as a raw Uint8Array, but the
// server sends them base64url-encoded (the standard wire format) - this is
// the standard conversion between the two.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush(socket) {
  if (!isPushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const res = await fetch(`${apiOrigin}/push/vapidPublicKey`);
  const { key } = await res.json();
  if (!key) return false;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  socket.current.emit("pushSubscribe", sub.toJSON());
  localStorage.setItem(STORAGE_KEY, "true");
  return true;
}

export async function unsubscribeFromPush(socket) {
  localStorage.setItem(STORAGE_KEY, "false");
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    socket.current.emit("pushUnsubscribe", { endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}
