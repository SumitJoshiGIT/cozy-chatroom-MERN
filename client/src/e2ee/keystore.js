// Device-only storage, separate from the message cache. It survives logout:
// without a passphrase, this may be the only copy of the account's key.
const DB_NAME = "LavenderKeys";

function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("identity");
      request.result.createObjectStore("pins");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(storeName, mode, action) {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export const loadIdentity = (uid) => run("identity", "readonly", (store) => store.get(uid));
export const saveIdentity = (uid, identity) => run("identity", "readwrite", (store) => store.put(identity, uid));
export const loadPin = (uid) => run("pins", "readonly", (store) => store.get(uid));
export const savePin = (uid, pin) => run("pins", "readwrite", (store) => store.put(pin, uid));
