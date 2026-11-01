import { post } from "./components/Axios";
import { clearStoredAuthToken, getStoredAuthToken } from "./socketAuthToken";
import { unsubscribeFromPush } from "./pushNotifications";

const DB_NAME = "ChatApp";

// Message history is cached in the browser, so it has to go when the account
// does - otherwise the next person on this browser inherits it.
export function clearLocalData(db) {
  if (db) db.close();
  try {
    localStorage.removeItem("lavender-drafts");
  } catch {}
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

export async function logout({ socket, db, navigate, everywhere = false }) {
  await unsubscribeFromPush(socket).catch(() => {});
  const token = getStoredAuthToken();
  await post("/auth/logout", { everywhere }, token ? { Authorization: `Bearer ${token}` } : undefined);
  clearStoredAuthToken();
  socket.current.disconnect();
  await clearLocalData(db);
  navigate("/auth/signin");
}
