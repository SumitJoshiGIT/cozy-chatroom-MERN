import * as crypto from "./crypto";
import { loadIdentity, saveIdentity, loadPin, savePin } from "./keystore";

export const LOCKED_TEXT = "🔒 Approve this device to read this message";
export const UNREADABLE_TEXT = "🔒 This message can't be decrypted on this device";
const KEY_CACHE_MS = 60000;

// Holds one signed-in account's keys for the lifetime of the page.
export function createE2ee({ socket, userId, onStatus, onKeyChange, onEnabled, onLinkCode }) {
  let status = crypto.isSupported() ? "loading" : "unavailable";
  let identity = null;
  let sendQueue = Promise.resolve();
  const keyCache = new Map();

  const setStatus = (next) => {
    status = next;
    onStatus(next);
  };
  const request = (event, data) => socket.current.timeout(8000).emitWithAck(event, data);

  async function load(serverPublicKey) {
    if (status === "unavailable") return onStatus(status);
    identity = (await loadIdentity(userId)) || null;
    if (!serverPublicKey) {
      identity = null;
      try {
        await createKey(false);
        onEnabled();
      } catch {
        setStatus("none");
      }
      return;
    }
    if (identity?.publicKey !== serverPublicKey) {
      identity = null;
      setStatus("locked");
      return requestLink();
    }
    setStatus("ready");
  }

  async function adopt(next) {
    identity = next;
    await saveIdentity(userId, identity);
    stopLink();
    setStatus("ready");
  }

  // Without replace, the server refuses if another tab got there first.
  async function createKey(replace) {
    const created = await crypto.createIdentity();
    const result = await request("e2eeSetKey", { publicKey: created.publicKey, replace });
    if (result?.publicKey) return load(result.publicKey);
    if (!result?.ok) throw new Error("The key could not be saved.");
    await adopt(created);
  }

  // A new device asks every other signed-in device for the account key.
  let link = null;
  function stopLink() {
    clearInterval(link?.timer);
    link = null;
    onLinkCode(null);
  }

  async function requestLink() {
    if (link) return;
    link = await crypto.createIdentity();
    onLinkCode(await crypto.linkCode(link.publicKey));
    const ask = () => socket.current.emit("e2eeLinkRequest", { publicKey: link.publicKey });
    ask();
    link.timer = setInterval(ask, 5000);
  }

  async function receiveLink(sealed) {
    if (!link) return;
    try {
      await adopt(await crypto.openIdentity(sealed, link.privateKey));
    } catch {
      onKeyChange(userId);
    }
  }

  async function approveLink(requestId, publicKey) {
    if (status !== "ready") return;
    socket.current.emit("e2eeLinkGrant", { requestId, sealed: await crypto.sealIdentity(identity, publicKey) });
  }

  // Trust on first use: the server can't swap a key we've seen without the
  // user being warned, and can't quietly downgrade a contact to plaintext.
  async function pinKey(uid, publicKey) {
    const pin = await loadPin(uid);
    if (!publicKey) {
      if (pin) throw new Error("This contact's encryption key is missing. Message not sent.");
      return;
    }
    if (!pin) return savePin(uid, { keys: [publicKey] });
    if (pin.keys.includes(publicKey)) return;
    await savePin(uid, { keys: [...pin.keys, publicKey] });
    onKeyChange(uid);
  }

  async function publicKeys(uids, { fresh = false } = {}) {
    const now = Date.now();
    const unknown = uids.filter((uid) => fresh || !(keyCache.get(uid)?.expires > now));
    if (unknown.length) {
      const found = await request("e2eeKeys", { uids: unknown });
      await Promise.all(unknown.map(async (uid) => {
        await pinKey(uid, found[uid] || null);
        keyCache.set(uid, { key: found[uid] || null, expires: now + KEY_CACHE_MS });
      }));
    }
    return Object.fromEntries(uids.map((uid) => [uid, keyCache.get(uid)?.key || null]));
  }

  async function recipientKeys(uids) {
    const others = [...new Set(uids.map(String))].filter((uid) => uid !== userId);
    const keys = others.length ? await publicKeys(others) : {};
    return { [userId]: identity.publicKey, ...keys };
  }

  const keysComplete = (keys) => Object.values(keys).every(Boolean);

  async function willEncrypt(uids) {
    if (status !== "ready") return false;
    return keysComplete(await recipientKeys(uids));
  }

  async function sealFiles(attachments) {
    const sealed = [];
    const details = [];
    for (const attachment of attachments) {
      const { ct, key, iv } = await crypto.encryptBytes(crypto.fromBase64(attachment.file));
      sealed.push({ file: crypto.toBase64(ct) });
      details.push({ key, iv, name: attachment.name, type: attachment.type, size: attachment.size });
    }
    return { sealed, details };
  }

  // Returns the fields to send. Falls back to plaintext only when someone in
  // the chat has no key at all, which the chat shows as not encrypted.
  async function prepare(uids, { content = "", attachments = [], location, keptFiles = [] }) {
    if (status === "locked" || status === "loading") throw new Error("Approve this device to send messages.");
    if (status !== "ready") return { content, attachments };
    const recipients = await recipientKeys(uids);
    if (!keysComplete(recipients)) return { content, attachments };
    const { sealed, details } = await sealFiles(attachments);
    const e2ee = await crypto.seal({ t: content, f: [...keptFiles, ...details], l: location }, {
      senderId: userId, privateKey: identity.privateKey, publicKey: identity.publicKey, recipients,
    });
    return { content: "", attachments: sealed, e2ee };
  }

  // Sealing is async, so this keeps messages in the order they were sent.
  function enqueue(task) {
    const result = sendQueue.then(task, task);
    sendQueue = result.catch(() => {});
    return result;
  }

  async function assertSenderKey(senderId, publicKey) {
    if (senderId === userId) {
      if (publicKey !== identity.publicKey) throw new Error("Sent from an older key");
      return;
    }
    if ((await loadPin(senderId))?.keys.includes(publicKey)) return;
    await publicKeys([senderId], { fresh: true });
    if (!(await loadPin(senderId))?.keys.includes(publicKey)) throw new Error("Unknown sender key");
  }

  async function unseal(envelope, senderId) {
    const sender = String(senderId);
    await assertSenderKey(sender, envelope.spk);
    return crypto.open(envelope, { senderId: sender, recipientId: userId, privateKey: identity.privateKey });
  }

  async function openMessage(message) {
    if (!message) return message;
    const opened = message.replyToMessage
      ? { ...message, replyToMessage: await openMessage(message.replyToMessage) }
      : message;
    if (!opened.e2ee) return opened;
    if (status !== "ready") return { ...opened, encrypted: true, locked: true, content: LOCKED_TEXT };
    try {
      const plain = await unseal(opened.e2ee, opened.uid);
      const attachments = (opened.attachments || []).map((attachment, index) => {
        const detail = plain.f?.[index] || {};
        return {
          src: attachment.src,
          name: detail.name,
          contentType: crypto.safeMediaType(detail.type),
          size: detail.size,
          sealedWith: { key: detail.key, iv: detail.iv },
        };
      });
      const located = plain.l ? { type: "location", location: { ...opened.location, ...plain.l } } : {};
      return { ...opened, ...located, encrypted: true, locked: false, unreadable: false, content: plain.t || "", attachments };
    } catch {
      return { ...opened, encrypted: true, locked: false, unreadable: true, content: UNREADABLE_TEXT };
    }
  }

  async function openPreview(last) {
    if (!last?.e2ee) return last;
    if (status !== "ready") return { ...last, locked: true, content: LOCKED_TEXT };
    try {
      const plain = await unseal(last.e2ee, last.uid);
      const first = plain.f?.[0];
      return {
        ...last,
        locked: false,
        content: plain.t || "",
        type: plain.l ? "location" : last.type,
        attachmentType: first && crypto.safeMediaType(first.type),
        attachmentName: first?.name,
      };
    } catch {
      return { ...last, locked: false, content: UNREADABLE_TEXT };
    }
  }

  async function safetyNumberWith(uid) {
    if (status !== "ready") return null;
    const key = (await publicKeys([uid], { fresh: true }))[uid];
    return key ? crypto.safetyNumber(identity.publicKey, key) : null;
  }

  return {
    load, createKey, requestLink, receiveLink, approveLink, linkCode: crypto.linkCode, willEncrypt, prepare, enqueue, openMessage, openPreview, safetyNumberWith,
    unseal,
    get status() { return status; },
  };
}
