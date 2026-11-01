// Primitives only: no sockets, storage or React, so they run under Node too.
const subtle = globalThis.crypto?.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CURVE = { name: "ECDH", namedCurve: "P-256" };
const PBKDF2_ITERATIONS = 600000;

export const isSupported = () => !!subtle;

export const toBase64 = (bytes) => {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
};
export const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

const importPublic = (publicKey) => subtle.importKey("raw", fromBase64(publicKey), CURVE, false, []);
const importPrivate = (pkcs8) => subtle.importKey("pkcs8", pkcs8, CURVE, false, ["deriveBits"]);

async function passphraseKey(passphrase, salt, iterations) {
  const base = await subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

// The private key is extractable only inside this function, to back it up.
export async function createIdentity(passphrase) {
  const pair = await subtle.generateKey(CURVE, true, ["deriveBits"]);
  const publicKey = toBase64(await subtle.exportKey("raw", pair.publicKey));
  const pkcs8 = await subtle.exportKey("pkcs8", pair.privateKey);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await passphraseKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, pkcs8);
  return {
    publicKey,
    privateKey: await importPrivate(pkcs8),
    backup: { ct: toBase64(ct), iv: toBase64(iv), salt: toBase64(salt), iterations: PBKDF2_ITERATIONS },
  };
}

// Throws on a wrong passphrase: AES-GCM authenticates the key it unwraps.
export async function restoreIdentity(backup, passphrase) {
  const key = await passphraseKey(passphrase, fromBase64(backup.salt), backup.iterations);
  const pkcs8 = await subtle.decrypt({ name: "AES-GCM", iv: fromBase64(backup.iv) }, key, fromBase64(backup.ct));
  return importPrivate(pkcs8);
}

// Static-static ECDH: only the two parties can make this key, so a valid wrap
// also proves who sent it, and one group member can't forge another.
async function pairKey(privateKey, otherPublicKey) {
  const bits = await subtle.deriveBits({ name: "ECDH", public: await importPublic(otherPublicKey) }, privateKey, 256);
  const base = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: encoder.encode("lavender-e2ee-v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

// Binds a message to its sender and recipients, so the server can't change
// who it claims to be from or replay it into a chat with other members.
const bindingOf = (senderId, recipientIds) => encoder.encode(`${senderId}|${[...recipientIds].sort().join(",")}`);

export async function seal(plain, { senderId, privateKey, publicKey, recipients }) {
  const additionalData = bindingOf(senderId, Object.keys(recipients));
  const contentKey = randomBytes(32);
  const aesKey = await subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv, additionalData }, aesKey, encoder.encode(JSON.stringify(plain)));
  const keys = {};
  await Promise.all(Object.entries(recipients).map(async ([uid, recipientKey]) => {
    const wrapIv = randomBytes(12);
    const wrapKey = await pairKey(privateKey, recipientKey);
    const wrapped = await subtle.encrypt({ name: "AES-GCM", iv: wrapIv, additionalData }, wrapKey, contentKey);
    keys[uid] = { iv: toBase64(wrapIv), k: toBase64(wrapped) };
  }));
  return { v: 1, spk: publicKey, iv: toBase64(iv), ct: toBase64(ct), keys };
}

export async function open(envelope, { senderId, recipientId, privateKey }) {
  const entry = envelope.keys?.[recipientId];
  if (!entry) throw new Error("Not a recipient");
  const additionalData = bindingOf(senderId, Object.keys(envelope.keys));
  const wrapKey = await pairKey(privateKey, envelope.spk);
  const contentKey = await subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(entry.iv), additionalData }, wrapKey, fromBase64(entry.k),
  );
  const aesKey = await subtle.importKey("raw", contentKey, "AES-GCM", false, ["decrypt"]);
  const plain = await subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.iv), additionalData }, aesKey, fromBase64(envelope.ct),
  );
  return JSON.parse(decoder.decode(plain));
}

export async function encryptBytes(bytes) {
  const rawKey = randomBytes(32);
  const iv = randomBytes(12);
  const key = await subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { ct: new Uint8Array(ct), key: toBase64(rawKey), iv: toBase64(iv) };
}

export async function decryptBytes(ct, { key, iv }) {
  const aesKey = await subtle.importKey("raw", fromBase64(key), "AES-GCM", false, ["decrypt"]);
  return subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, aesKey, ct);
}

// Two people compare this out of band. Sorted, so both see the same number.
export async function safetyNumber(publicKeyA, publicKeyB) {
  const joined = [publicKeyA, publicKeyB].sort().join("|");
  const digest = new Uint8Array(await subtle.digest("SHA-256", encoder.encode(joined)));
  const groups = [];
  for (let i = 0; i < 24; i += 2) groups.push(String(((digest[i] << 8) | digest[i + 1]) % 100000).padStart(5, "0"));
  return groups.join(" ");
}
