const models = require("../../models/exports");
const { verifyTokenPayload, issueMediaToken } = require("../../utils/socketAuthTokens");
const { webpush, enabled: webPushEnabled } = require("../../utils/webPush");
const callState = require("../../utils/callState");
const { UPLOAD_DIR, ATTACHMENT_DIR, ATTACHMENT_PREFIX, removeUpload } = require("../../utils/uploads");
const ObjectID = require("mongoose").Types.ObjectId;
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
// SVG deliberately excluded: it's served via express.static, and an uploaded
// SVG can embed <script> - a stored-XSS vector if it's ever opened directly
// rather than rendered inside an <img> tag.
const allowedTypes = {
  "image/png":"png",
  "image/jpeg":"jpg",
  "image/jpg":"jpg",
  "image/webp":"webp",
};
const allowedDocTypes = {
  "application/pdf":"pdf",
  "application/msword":"doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx",
  "application/vnd.ms-excel":"xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx",
  "application/vnd.ms-powerpoint":"ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":"pptx",
  "text/plain":"txt",
  "text/csv":"csv",
  "application/zip":"zip",
};
const allowedAudioTypes = {
  "audio/webm":"webm",
  "audio/ogg":"ogg",
  "audio/mp4":"m4a",
  "audio/mpeg":"mp3",
  "audio/wav":"wav",
};
const allowedVideoTypes = {
  "video/mp4":"mp4",
  "video/webm":"webm",
  "video/ogg":"ogv",
  "video/quicktime":"mov",
};
const maxUploadSize = 2*1024*1024;
const UPLOAD_QUOTA_BYTES = 100*1024*1024;
const UPLOAD_QUOTA_WINDOW_MS = 60*60*1000;
const MAX_MESSAGE_LENGTH = 10000;
const MAX_PINS = 6;
const MAX_REACTIONS_PER_MESSAGE = 20;
const MAX_GROUP_MEMBERS = 256;
const DISAPPEARING_DURATIONS = [24 * 60 * 60, 7 * 24 * 60 * 60, 90 * 24 * 60 * 60];
const CALL_RECONNECT_GRACE_MS = Number(process.env.CALL_RECONNECT_GRACE_MS) || 10000;
const EVENT_BUCKET_CAPACITY = 300;
const EVENT_BUCKET_REFILL_PER_SEC = 30;
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const DEMO_CONTACT_EMAIL_RE = /@lavender\.demo$/;

const PERMISSION_DEFAULTS = { sendMessages: "everyone", editInfo: "admins", pinMessages: "admins" };
const PUBLIC_PROFILE_FIELDS = "name username about img color updatedAt";

// Client ids arrive as untrusted JSON. Requiring a plain 24-hex string here
// also stops query operators ({$ne:null}) reaching findById, which would
// otherwise match an arbitrary document.
const isId = (value) => typeof value === "string" && OBJECT_ID_RE.test(value);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cleanText = (value, max) => (typeof value === "string" ? value.replace(/\u0000/g, "").slice(0, max) : "");

// Never send credentials down the socket, not even to their owner.
function safeSelf(user) {
  const { password, sub, tokensValidAfter, __v, ...rest } = user.toObject ? user.toObject() : user;
  return rest;
}

async function resolvePermissions(chat) {
  const perm = chat.permissions ? await models.PermissionsModel.findById(chat.permissions) : null;
  return { ...PERMISSION_DEFAULTS, ...(perm ? perm.permission : {}) };
}

function matchesSignature(buffer, type) {
  const hex = (n, offset = 0) => buffer.subarray(offset, offset + n).toString("hex");
  switch (type) {
    case "image/png": return hex(4) === "89504e47";
    case "image/jpeg":
    case "image/jpg": return hex(3) === "ffd8ff";
    case "image/webp": return buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP";
    case "application/pdf": return buffer.subarray(0, 4).toString("latin1") === "%PDF";
    case "application/zip":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return hex(2) === "504b";
    case "application/msword":
    case "application/vnd.ms-excel":
    case "application/vnd.ms-powerpoint":
      return hex(4) === "d0cf11e0";
    default: return true;
  }
}

const uploadUsage = new Map();
function consumeUploadQuota(uid, bytes) {
  const now = Date.now();
  const key = String(uid);
  let usage = uploadUsage.get(key);
  if (!usage || usage.resetAt <= now) usage = { bytes: 0, resetAt: now + UPLOAD_QUOTA_WINDOW_MS };
  if (usage.bytes + bytes > UPLOAD_QUOTA_BYTES) return false;
  usage.bytes += bytes;
  uploadUsage.set(key, usage);
  return true;
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const isBase64 = (value, max) => typeof value === "string" && value.length > 0 && value.length <= max && BASE64_RE.test(value);
const MAX_E2EE_RECIPIENTS = 1024;
const MAX_E2EE_TEXT = 256 * 1024;

// The server can't read an envelope, but it can refuse junk and bound its size.
function isEnvelope(value) {
  if (!value || typeof value !== "object" || value.v !== 1) return false;
  if (!isBase64(value.spk, 128) || !isBase64(value.iv, 32) || !isBase64(value.ct, MAX_E2EE_TEXT)) return false;
  const entries = value.keys && typeof value.keys === "object" ? Object.entries(value.keys) : [];
  if (!entries.length || entries.length > MAX_E2EE_RECIPIENTS) return false;
  return entries.every(([uid, entry]) => isId(uid) && entry && isBase64(entry.iv, 32) && isBase64(entry.k, 128));
}

const isKeyBackup = (value) => !!value && isBase64(value.ct, 1024) && isBase64(value.iv, 32) && isBase64(value.salt, 64)
  && Number.isInteger(value.iterations) && value.iterations >= 100000 && value.iterations <= 10000000;

// Sealed files are opaque by design, so there is no type or signature to check.
async function saveUpload(base64, mimeType, name, uid, extraTypes, isAttachment = false, sealed = false) {
  const allowList = extraTypes ? { ...allowedTypes, ...extraTypes } : allowedTypes;
  const normalizedType = sealed ? "application/octet-stream" : (typeof mimeType === "string" ? mimeType : "").split(';')[0].trim();
  if (typeof base64 !== "string" || !base64 || !(sealed || allowList[normalizedType])) return null;
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > maxUploadSize) return null;
  if (!sealed && !matchesSignature(buffer, normalizedType)) return null;
  if (!consumeUploadQuota(uid, buffer.length)) return null;
  const file = `${crypto.randomBytes(16).toString("hex")}.${sealed ? "bin" : allowList[normalizedType]}`;
  const dir = isAttachment ? ATTACHMENT_DIR : UPLOAD_DIR;
  const src = isAttachment ? `${ATTACHMENT_PREFIX}${file}` : file;
  try {
    // deploy-server.yml excludes public/ from rsync, so nothing else
    // guarantees this directory exists on a fresh deploy target.
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, file), buffer);
  } catch (err) {
    console.error("saveUpload: failed to write file", err);
    return null;
  }
  return { src, name: sealed ? "encrypted" : cleanText(name, 255) || "file", size: buffer.length, contentType: normalizedType };
}

// Denormalized onto Chats so the sync manifest can tell a chat changed
// without loading message history, and the sidebar can show a preview
// without having fetched that chat's messages at all. findByIdAndUpdate also
// bumps updatedAt, which is what makes the manifest's diff fire.
function lastMessageSnapshot(message) {
  const firstAttachment = Array.isArray(message.attachments) && message.attachments.length ? message.attachments[0] : null;
  return {
    _id: message._id,
    mid: message.mid,
    uid: message.uid,
    type: message.type,
    content: message.content,
    e2ee: message.e2ee || undefined,
    attachmentType: firstAttachment ? firstAttachment.contentType : undefined,
    attachmentName: firstAttachment ? firstAttachment.name : undefined,
    liveLocation: message.location ? !!message.location.live : undefined,
    createdAt: message.createdAt,
    expiresAt: message.expiresAt || undefined,
  };
}

async function updateLastMessage(cid, message) {
  await models.ChatsModel.findByIdAndUpdate(cid, { $set: { lastMessage: lastMessageSnapshot(message) } });
}

// Missed and declined calls are ordinary messages, so they get the history,
// sidebar preview and unread badge without any call-specific sync.
async function recordCall(io, call, outcome) {
  try {
    const chat = await models.ChatsModel.findById(call.cid);
    if (!chat) return;
    const message = new models.MessagesModel({
      chat: call.cid,
      uid: call.callerId,
      type: "call",
      content: `${outcome} ${call.kind === "audio" ? "voice" : "video"} call`,
      status: "✔",
      expiresAt: chat.disappearingDuration ? new Date(Date.now() + chat.disappearingDuration * 1000) : null,
    });
    await message.save();
    await updateLastMessage(call.cid, message);
    const refreshed = await models.ChatsModel.findById(call.cid);
    io.to(call.cid).emit("chat", { type: "chats", chats: [refreshed] });
    io.to(call.cid).emit("messages", { id: call.cid, data: [message] });
  } catch (err) {
    console.error("[socket] recordCall failed", err.message);
  }
}

// Recomputes the preview from whatever message survives - used after a
// delete, and when a disappearing message's expiry makes the preview stale.
async function refreshLastMessage(cid) {
  const survivor = await models.MessagesModel.findOne({
    chat: cid,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).sort({ mid: -1 });
  return models.ChatsModel.findByIdAndUpdate(
    cid,
    { $set: { lastMessage: survivor ? lastMessageSnapshot(survivor) : null } },
    { new: true }
  );
}

async function purgeChat(cid, io) {
  const chat = await models.ChatsModel.findById(cid);
  if (!chat) return;
  const withFiles = await models.MessagesModel.find({ chat: cid, "attachments.0": { $exists: true } }, "attachments");
  withFiles.forEach((m) => m.attachments.forEach((a) => removeUpload(a.src)));
  removeUpload(chat.img && chat.img.src);
  await models.MessagesModel.deleteMany({ chat: cid });
  await models.ReadPositionsModel.deleteMany({ chat: cid });
  await models.ChatsModel.findByIdAndDelete(cid);
  await models.UsersModel.updateMany({ _id: { $in: chat.users } }, { $pull: { Chats: chat._id } });
  io.to(cid).emit("leaveChat", [cid, true]);
  io.in(cid).socketsLeave(cid);
}

// Runs before the "connection" event, so every listener below is registered
// synchronously with no window where a client's first events can be lost.
async function authenticateSocket(socket, next) {
  let user = null;
  try {
    const payload = verifyTokenPayload(socket.handshake.auth && socket.handshake.auth.token);
    if (payload) {
      user = await models.UsersModel.findById(payload.uid);
      if (user && user.tokensValidAfter && payload.iat < user.tokensValidAfter.getTime()) user = null;
    }
    const sessionUser = socket.handshake.session?.passport?.user?._id;
    if (!user && sessionUser) user = await models.UsersModel.findById(sessionUser);
    if (user && user.isDemo && user.demoExpiresAt <= new Date()) user = null;
  } catch (err) {
    console.error("[socket] authentication failed", err.message);
    user = null;
  }
  socket.data.profile = user;
  socket.data.viaToken = !!user && !!verifyTokenPayload(socket.handshake.auth && socket.handshake.auth.token);
  socket.data.sessionId = socket.handshake.sessionID || null;
  next();
}

function onConnection(socket, io) {
  let profile = socket.data.profile;
  socket.emit("auth", profile ? safeSelf(profile) : null);
  if (!profile) {
    socket.disconnect();
    return;
  }

  const selfId = profile._id.toString();
  const userRoom = (uid) => `user:${uid}`;
  // socket.rooms is the single source of truth for live membership. Every
  // device of a user is moved in and out of chat rooms together (see
  // addToRoom/removeFromRoom), so kicks and invites take effect immediately
  // instead of waiting for that socket's next reconnect.
  const inChat = (cid) => isId(cid) && socket.rooms.has(cid);
  const memberChatIds = () => [...socket.rooms].filter(isId);
  const addToRoom = (uid, cid) => io.in(userRoom(uid)).socketsJoin(String(cid));
  const removeFromRoom = (uid, cid) => io.in(userRoom(uid)).socketsLeave(String(cid));
  const sameId = (a, b) => String(a) === String(b);

  // Atomic, so one device's stale in-memory profile can't overwrite array
  // changes (stars, blocks, chats) made from another device.
  const updateSelf = async (update) => {
    const fresh = await models.UsersModel.findByIdAndUpdate(profile._id, update, { new: true });
    if (fresh) profile = fresh;
    return profile;
  };

  const socketLog = (event, details = {}) => {
    console.info("[socket]", JSON.stringify({ event, socketId: socket.id, userId: selfId, ...details }));
  };

  let bucket = EVENT_BUCKET_CAPACITY;
  let bucketAt = Date.now();
  const takeEventToken = () => {
    const now = Date.now();
    bucket = Math.min(EVENT_BUCKET_CAPACITY, bucket + ((now - bucketAt) / 1000) * EVENT_BUCKET_REFILL_PER_SEC);
    bucketAt = now;
    if (bucket < 1) return false;
    bucket -= 1;
    return true;
  };

  // Wrapping registration means one bad payload is logged instead of becoming
  // an unhandled rejection, and every event shares the same rate limit.
  const rawSocketOn = socket.on.bind(socket);
  socket.on = (event, handler) => rawSocketOn(event, async (...args) => {
    if (!takeEventToken()) {
      if (event === "sendMessage" || event === "createChatPrivate") {
        socket.emit("messageError", { event, replace: args[0] && args[0].replace, message: "You're sending too fast. Please wait a moment." });
      }
      return;
    }
    try {
      await handler(...args);
    } catch (err) {
      console.error("[socket] handler failed", JSON.stringify({ event, socketId: socket.id, userId: selfId, message: err.message, stack: err.stack }));
    }
  });

  socket.join(userRoom(selfId));
  socket.emit("mediaToken", issueMediaToken(selfId));
  profile.Chats.forEach((chat) => socket.join(chat.toString()));
  socketLog("auth", { authenticated: true });

  function isChatAdmin(chat) {
    return (chat.admins || []).some((a) => sameId(a, selfId)) || (chat.owner && sameId(chat.owner, selfId));
  }
  function isChatOwner(chat) {
    return chat.owner && sameId(chat.owner, selfId);
  }
  async function canPerform(chat, key) {
    if (isChatAdmin(chat)) return true;
    const perm = await resolvePermissions(chat);
    return perm[key] === "everyone";
  }

  // Null unless the sender may post here; shared by text, media and location.
  async function loadWritableChat(cid, replace) {
    const fail = (message) => {
      socket.emit("messageError", { event: "sendMessage", replace, message });
      return null;
    };
    const chat = await models.ChatsModel.findById(cid);
    if (!chat) return fail("This conversation could not be found. Refresh and try again.");
    if (chat.type === "private") {
      const otherId = (chat.users || []).find((u) => !sameId(u, selfId));
      if (otherId) {
        const other = await models.UsersModel.findById(otherId, "blocked");
        if (other && other.blocked.some((b) => sameId(b, selfId))) return fail("This message could not be delivered.");
      }
    }
    if (chat.type === "group" && !(await canPerform(chat, "sendMessages"))) {
      return fail("You do not have permission to send messages in this group.");
    }
    return chat;
  }

  // A DM the other person removed from their list comes back when a new
  // message arrives, like every mainstream chat app.
  async function restorePrivateChat(chat) {
    if (chat.type !== "private") return;
    const restored = await models.UsersModel.find({ _id: { $in: chat.users }, Chats: { $ne: chat._id } }, "_id");
    for (const user of restored) {
      await models.UsersModel.findByIdAndUpdate(user._id, { $addToSet: { Chats: chat._id } });
      addToRoom(user._id, chat._id);
      io.to(userRoom(user._id)).emit("chat", { type: "chats", chats: [chat] });
    }
  }

  async function sendPushNotifications(chat, message) {
    if (!webPushEnabled) return;
    const recipients = [...new Set((chat.users || []).map(String))].filter((u) => u !== selfId);
    if (!recipients.length) return;
    const senderName = profile.name || profile.username;
    const title = chat.type === "group" && chat.name ? `${senderName} (${chat.name})` : senderName;
    const body = message.e2ee ? "New encrypted message"
      : message.type === "location" ? "Shared a location"
      : message.content ? message.content.slice(0, 200)
      : (message.attachments && message.attachments.length) ? "Sent an attachment"
      : "New message";
    const payload = JSON.stringify({ title, body, chatId: chat._id.toString() });
    for (const uid of recipients) {
      const sockets = await io.in(userRoom(uid)).fetchSockets();
      if (sockets.length > 0) continue;
      const recipient = await models.UsersModel.findById(uid, "mutedChats");
      const muted = recipient && recipient.mutedChats.some((m) => sameId(m.chat, chat._id) && (!m.mutedUntil || m.mutedUntil > new Date()));
      if (muted) continue;
      const subs = await models.PushSubscriptionsModel.find({ user: uid });
      for (const sub of subs) {
        webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload).catch(async (err) => {
          // 404/410 means the browser revoked this subscription.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await models.PushSubscriptionsModel.deleteOne({ _id: sub._id });
          } else {
            console.error("push send failed", err.statusCode);
          }
        });
      }
    }
  }

  const expiryFor = (chat) => (chat.disappearingDuration ? new Date(Date.now() + chat.disappearingDuration * 1000) : null);

  async function SendMessage(message) {
    socketLog("sendMessage:received", { cid: message && message.cid, replace: message && message.replace });
    if (!message || !inChat(message.cid)) {
      socket.emit("messageError", {
        event: "sendMessage",
        replace: message && message.replace,
        message: "This conversation is no longer available. Refresh and try again.",
      });
      return;
    }
    const replace = message.replace;
    const sealed = message.e2ee ? message.e2ee : null;
    if (sealed && !isEnvelope(sealed)) {
      socket.emit("messageError", { event: "sendMessage", replace, message: "That encrypted message was not valid." });
      return;
    }
    if (typeof message.content === "string" && message.content.length > MAX_MESSAGE_LENGTH) {
      socket.emit("messageError", { event: "sendMessage", replace, message: "That message is too long." });
      return;
    }
    const parentChat = await loadWritableChat(message.cid, replace);
    if (!parentChat) return;

    // Only keep a reply reference that really belongs to this chat. The
    // message query joins reply_to, so an unchecked id would let a sender
    // pull a message out of a conversation they aren't in.
    let replyTo = null;
    if (isId(message.reply_to)) {
      const target = await models.MessagesModel.exists({ _id: message.reply_to, chat: message.cid });
      if (target) replyTo = message.reply_to;
    }

    const attachments = [];
    if (Array.isArray(message.attachments)) {
      for (const attachment of message.attachments.slice(0, 10)) {
        if (!attachment) continue;
        const saved = await saveUpload(attachment.file, attachment.type, attachment.name, selfId, { ...allowedDocTypes, ...allowedAudioTypes, ...allowedVideoTypes }, true, !!sealed);
        if (saved) attachments.push(saved);
      }
    }
    // Sealed messages keep nothing readable, even if a client sends both.
    const content = sealed ? "" : cleanText(message.content, MAX_MESSAGE_LENGTH);
    if (!sealed && !content.trim() && !attachments.length) {
      socket.emit("messageError", { event: "sendMessage", replace, message: "That attachment couldn't be sent. Check its type and size." });
      return;
    }
    const newMessage = new models.MessagesModel({
      chat: message.cid,
      content,
      e2ee: sealed,
      uid: profile._id,
      reply_to: replyTo,
      status: "✔",
      attachments,
      expiresAt: expiryFor(parentChat),
    });
    try {
      await newMessage.save();
      await updateLastMessage(message.cid, newMessage);
      await restorePrivateChat(parentChat);
      const refreshed = await models.ChatsModel.findById(message.cid);
      io.to(message.cid).emit("chat", { type: "chats", chats: [refreshed] });
      io.to(message.cid).emit("messages", { id: message.cid, replace, data: [newMessage] });
      sendPushNotifications(parentChat, newMessage).catch((err) => console.error("push failed", err.message));
      socketLog("sendMessage:sent", { cid: message.cid, messageId: String(newMessage._id) });
    } catch (err) {
      console.error("[socket] sendMessage:failed", err);
      socket.emit("messageError", { event: "sendMessage", replace, message: "Your message could not be saved. Please try again." });
    }
  }

  socket.on("getMediaToken", () => socket.emit("mediaToken", issueMediaToken(selfId)));

  // Knowing a group's id grants nothing: joining takes a secret that an admin
  // chose to share and can revoke.
  async function issueInvite(cid, rotate) {
    if (!inChat(cid)) return;
    const chat = await models.ChatsModel.findById(cid).select("+inviteCode");
    if (!chat || chat.type !== "group" || !isChatAdmin(chat)) return;
    if (rotate || !chat.inviteCode) {
      chat.inviteCode = crypto.randomBytes(18).toString("base64url");
      await chat.save();
    }
    socket.emit("inviteCode", { cid, code: chat.inviteCode });
  }
  socket.on("getInviteCode", ({ cid } = {}) => issueInvite(cid, false));
  socket.on("resetInviteCode", ({ cid } = {}) => issueInvite(cid, true));

  socket.on("joinByInvite", async ({ code } = {}) => {
    const invalid = () => socket.emit("chatError", { message: "This invite link is invalid or has been reset." });
    if (typeof code !== "string" || !code || code.length > 64) return invalid();
    if (profile.isDemo) return socket.emit("chatError", { message: "Demo accounts cannot join groups." });
    const target = await models.ChatsModel.findOne({ inviteCode: code, type: "group" }, "users");
    if (!target) return invalid();
    const cid = target._id.toString();
    if (!inChat(cid) && target.users.length >= MAX_GROUP_MEMBERS) {
      return socket.emit("chatError", { message: "This group is full." });
    }
    const chat = await models.ChatsModel.findByIdAndUpdate(cid, { $addToSet: { users: profile._id } }, { new: true });
    await updateSelf({ $addToSet: { Chats: chat._id } });
    addToRoom(selfId, cid);
    socket.emit("chat", { type: "join", chats: [chat] });
    socket.to(cid).emit("chat", { type: "chats", chats: [chat] });
    socket.emit("inviteJoined", { cid });
  });

  socket.on("sendMessage", SendMessage);

  socket.on("sendLocation", async (stream, ack) => {
    if (!stream || !inChat(stream.cid)) return;
    const lat = Number(stream.lat);
    const lng = Number(stream.lng);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    const parentChat = await loadWritableChat(stream.cid, stream.replace);
    if (!parentChat) return;
    const live = !!stream.live;
    const durationMs = Math.min(Math.max(Number(stream.durationMs) || 0, 0), 8 * 60 * 60 * 1000);
    const newMessage = new models.MessagesModel({
      chat: stream.cid,
      content: "",
      type: "location",
      uid: profile._id,
      status: "✔",
      location: { lat, lng, live, expiresAt: live ? new Date(Date.now() + (durationMs || 15 * 60 * 1000)) : null },
      expiresAt: expiryFor(parentChat),
    });
    await newMessage.save();
    await updateLastMessage(stream.cid, newMessage);
    await restorePrivateChat(parentChat);
    const refreshed = await models.ChatsModel.findById(stream.cid);
    io.to(stream.cid).emit("chat", { type: "chats", chats: [refreshed] });
    io.to(stream.cid).emit("messages", { id: stream.cid, replace: stream.replace, data: [newMessage] });
    sendPushNotifications(parentChat, newMessage).catch((err) => console.error("push failed", err.message));
    if (typeof ack === "function") ack({ _id: newMessage._id.toString() });
  });

  socket.on("updateLocation", async (stream) => {
    if (!stream || !isId(stream.id)) return;
    const lat = Number(stream.lat);
    const lng = Number(stream.lng);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    const message = await models.MessagesModel.findById(stream.id);
    if (!message || !message.location || !message.location.live) return;
    if (!sameId(message.uid, selfId) || !inChat(message.chat.toString())) return;
    if (message.location.expiresAt && message.location.expiresAt.getTime() < Date.now()) return;
    message.location.lat = lat;
    message.location.lng = lng;
    await message.save();
    io.to(message.chat.toString()).emit("locationUpdated", { cid: message.chat.toString(), mid: message.mid, lat, lng });
  });

  socket.on("stopLiveLocation", async (stream) => {
    if (!stream || !isId(stream.id)) return;
    const message = await models.MessagesModel.findById(stream.id);
    if (!message || !message.location || !message.location.live || !sameId(message.uid, selfId)) return;
    message.location.live = false;
    await message.save();
    io.to(message.chat.toString()).emit("locationStopped", { cid: message.chat.toString(), mid: message.mid });
  });

  const buildSearchTerm = (query) => {
    const text = cleanText(query, 64).trim();
    return text ? new RegExp(escapeRegex(text), "i") : null;
  };

  socket.on("search", async (stream) => {
    try {
      socketLog("search:received", { target: stream && stream.target, reqId: stream && stream.reqId });
      const term = buildSearchTerm(stream.query);
      if (!term) {
        socket.emit("searchResults", { results: [], target: stream.target, reqId: stream.reqId });
        return;
      }
      const chatIds = memberChatIds().map((id) => new ObjectID(id));

      const searchUsers = async () => {
        const users = await models.UsersModel.aggregate([
          {
            $match: {
              $or: [{ name: { $regex: term } }, { username: { $regex: term } }],
              blocked: { $ne: profile._id },
              ...(profile.isDemo ? { $and: [{ $or: [{ isDemo: true }, { email: { $regex: DEMO_CONTACT_EMAIL_RE } }] }] } : {}),
            },
          },
          { $project: { name: 1, username: 1, about: 1, img: 1, color: 1, updatedAt: 1 } },
          { $sort: { username: 1 } },
          { $limit: 10 },
        ]);
        return users.map((u) => ({ ...u, type: "user" }));
      };

      const searchChatsByName = () =>
        models.ChatsModel.aggregate([
          {
            $match: {
              _id: { $in: chatIds },
              type: { $ne: "private" },
              $or: [{ name: { $regex: term } }, { username: { $regex: term } }],
            },
          },
          { $project: { inviteCode: 0 } },
          { $sort: { name: 1 } },
          { $limit: 10 },
        ]);

      // "Messages" search: find chats (the user is in) containing a matching message.
      const searchChatsByMessage = () =>
        models.MessagesModel.aggregate([
          { $match: { chat: { $in: chatIds }, content: { $regex: term } } },
          { $sort: { updatedAt: -1 } },
          { $group: { _id: "$chat", updatedAt: { $first: "$updatedAt" } } },
          { $sort: { updatedAt: -1 } },
          { $limit: 10 },
          { $lookup: { from: "chats", localField: "_id", foreignField: "_id", as: "chatDoc" } },
          { $unwind: "$chatDoc" },
          { $replaceRoot: { newRoot: "$chatDoc" } },
          { $project: { inviteCode: 0 } },
        ]);

      let data;
      if (stream.target == 1) {
        data = await searchUsers();
      } else if (stream.target == 2) {
        data = await searchChatsByMessage();
      } else if (stream.target == 3) {
        data = await searchChatsByName();
      } else {
        const [users, byName, byMessage] = await Promise.all([searchUsers(), searchChatsByName(), searchChatsByMessage()]);
        const chats = [...byName];
        const seen = new Set(chats.map((c) => c._id.toString()));
        byMessage.forEach((c) => {
          if (!seen.has(c._id.toString())) {
            seen.add(c._id.toString());
            chats.push(c);
          }
        });
        data = [...chats, ...users];
      }

      socket.emit("searchResults", { results: data, target: stream.target, reqId: stream.reqId });
    } catch (err) {
      console.error("[socket] search:failed", err);
      socket.emit("searchError", { reqId: stream && stream.reqId, message: "Search failed" });
    }
  });

  socket.on("searchMessagesInChat", async ({ cid, query, reqId } = {}) => {
    const term = buildSearchTerm(query);
    if (!inChat(cid) || !term) {
      socket.emit("searchMessagesInChat", { cid, results: [], reqId });
      return;
    }
    const results = await models.MessagesModel.find({ chat: cid, content: { $regex: term } }, "_id mid content createdAt uid")
      .sort({ mid: 1 })
      .limit(100);
    socket.emit("searchMessagesInChat", { cid, results, reqId });
  });

  // Fetches specific messages regardless of pagination - pinned messages are
  // usually older than whatever's currently loaded.
  socket.on("getMessagesByIds", async ({ cid, ids } = {}) => {
    if (!inChat(cid) || !Array.isArray(ids) || ids.length === 0) return;
    const wanted = ids.filter(isId).slice(0, 50).map((id) => new ObjectID(id));
    const results = await models.MessagesModel.aggregate([
      { $match: { _id: { $in: wanted }, chat: new ObjectID(cid) } },
      { $lookup: { from: "messages", localField: "reply_to", foreignField: "_id", as: "replyToMessage" } },
      { $unwind: { path: "$replyToMessage", preserveNullAndEmptyArrays: true } },
    ]);
    socket.emit("getMessagesByIds", { cid, results: results.filter(replyStaysInChat) });
  });

  // Older rows may hold an unvalidated reply_to; never let the join leak one.
  function replyStaysInChat(message) {
    if (message.replyToMessage && !sameId(message.replyToMessage.chat, message.chat)) delete message.replyToMessage;
    return true;
  }

  socket.on("report", async ({ id, targetType, reason } = {}) => {
    if (!isId(id) || !["user", "chat", "message"].includes(targetType)) return;
    await new models.ReportsModel({
      reporter: profile._id,
      target: id,
      targetType,
      reason: cleanText(reason, 1000),
    }).save();
  });

  socket.on("typing", ({ cid } = {}) => {
    if (!inChat(cid)) return;
    socket.to(cid).emit("typing", { cid, uid: selfId });
  });

  const finishCall = (call, reason) => {
    const members = [...call.members];
    callState.end(call);
    members.forEach((uid) => io.to(userRoom(uid)).emit("callEnded", { cid: call.cid, reason }));
  };

  const onRingTimeout = (call) => {
    const stopped = callState.stopRinging(call);
    stopped.forEach((uid) => io.to(userRoom(uid)).emit("callStopRinging", { cid: call.cid }));
    if (call.state !== "ringing") return;
    finishCall(call, "missed");
    recordCall(io, call, "Missed");
  };

  const leaveCall = (call, uid) => {
    const wasRinging = call.state === "ringing";
    if (!callState.leave(call, uid)) return;
    finishCall(call, wasRinging ? "cancelled" : "ended");
    if (wasRinging) recordCall(io, call, "Missed");
  };

  socket.on("startCall", async ({ cid, kind = "video" } = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    const refuse = (message) => reply({ ok: false, message });
    if (!inChat(cid)) return refuse("You are not in this chat.");
    const chat = await models.ChatsModel.findById(cid, "users type");
    if (!chat || !(chat.users || []).some((id) => sameId(id, selfId))) return refuse("You are not in this chat.");
    const callKind = kind === "audio" ? "audio" : "video";

    const existing = callState.get(cid);
    if (existing) {
      if (existing.joined.has(selfId)) return refuse("You are already on this call.");
      if (existing.ringing.has(selfId)) return refuse("You have an incoming call here. Answer or decline it.");
      if (existing.group && existing.state === "active" && !callState.isBusy(selfId)) {
        callState.join(existing, selfId, socket.id);
        return reply({ ok: true, kind: existing.kind, ringing: false });
      }
      return refuse("This chat is already on a call.");
    }
    if (callState.isBusy(selfId)) return refuse("You are already on a call.");

    const members = [...new Set(chat.users.map(String))];
    const others = members.filter((uid) => uid !== selfId);
    if (!others.length) return refuse("You can't call yourself.");
    if (chat.type === "private") {
      const other = await models.UsersModel.findById(others[0], "blocked name username");
      if (!other || other.blocked.some((b) => sameId(b, selfId))) return refuse("This call could not be placed.");
      if (callState.isBusy(others[0])) {
        recordCall(io, { cid, callerId: selfId, kind: callKind }, "Missed");
        return refuse(`${other.name || other.username || "This person"} is on another call.`);
      }
    }
    // Re-checked because the lookups above let another call start meanwhile.
    if (callState.get(cid) || callState.isBusy(selfId)) return refuse("This chat is already on a call.");
    const ringing = others.filter((uid) => !callState.isBusy(uid));
    if (!ringing.length) return refuse("Everyone is on another call.");

    callState.create({
      cid, callerId: selfId, socketId: socket.id, kind: callKind, group: chat.type !== "private",
      members, ringing, onTimeout: onRingTimeout,
    });
    ringing.forEach((uid) => io.to(userRoom(uid)).emit("incomingCall", {
      cid,
      roomName: `lavender-${cid}`,
      kind: callKind,
      caller: { id: selfId, name: profile.name || profile.username || "Lavender user" },
    }));
    reply({ ok: true, kind: callKind, ringing: true });
  });

  socket.on("answerCall", ({ cid } = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    const call = callState.get(cid);
    if (!call || !call.ringing.has(selfId)) return reply({ ok: false, message: "This call has ended." });
    callState.answer(call, selfId, socket.id);
    socket.to(userRoom(selfId)).emit("callStopRinging", { cid });
    for (const uid of call.members) io.to(userRoom(uid)).emit("callAnswered", { cid, uid: selfId });
    reply({ ok: true, kind: call.kind });
  });

  socket.on("declineCall", ({ cid } = {}) => {
    const call = callState.get(cid);
    if (!call || !call.ringing.has(selfId)) return;
    const nobodyLeft = callState.decline(call, selfId);
    socket.to(userRoom(selfId)).emit("callStopRinging", { cid });
    if (!nobodyLeft) return;
    finishCall(call, "declined");
    recordCall(io, call, "Declined");
  });

  socket.on("endCall", ({ cid } = {}) => {
    const call = callState.get(cid);
    if (call && call.joined.has(selfId)) leaveCall(call, selfId);
  });

  // A dropped socket doesn't end the media connection, so a reconnecting
  // client reclaims its place in the call before the grace period runs out.
  socket.on("resumeCall", ({ cid } = {}) => {
    const call = callState.get(cid);
    if (call && call.joined.has(selfId)) call.joined.set(selfId, socket.id);
    else socket.emit("callEnded", { cid, reason: "ended" });
  });

  // rawSocketOn: the rate limiter must never swallow this one.
  rawSocketOn("disconnect", () => {
    const active = callState.forUser(selfId);
    if (!active || active.joined.get(selfId) !== socket.id) return;
    setTimeout(() => {
      const call = callState.get(active.cid);
      if (call && call.joined.get(selfId) === socket.id) leaveCall(call, selfId);
    }, CALL_RECONNECT_GRACE_MS);
  });

  socket.on("e2eeSetKey", async ({ publicKey, backup } = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    if (!isBase64(publicKey, 128) || !isKeyBackup(backup)) return reply({ ok: false });
    const { ct, iv, salt, iterations } = backup;
    await models.UsersModel.findByIdAndUpdate(profile._id, { e2eePublicKey: publicKey, e2eeBackup: { ct, iv, salt, iterations } });
    profile.e2eePublicKey = publicKey;
    socket.to(userRoom(selfId)).emit("e2eeKeyChanged", { publicKey });
    reply({ ok: true });
  });

  socket.on("e2eeGetBackup", async (_, ack) => {
    if (typeof ack !== "function") return;
    const user = await models.UsersModel.findById(profile._id, "e2eePublicKey +e2eeBackup");
    ack({ publicKey: user?.e2eePublicKey || null, backup: user?.e2eeBackup || null });
  });

  socket.on("e2eeKeys", async ({ uids } = {}, ack) => {
    if (typeof ack !== "function" || !Array.isArray(uids)) return;
    const ids = uids.filter(isId).slice(0, MAX_E2EE_RECIPIENTS);
    const users = await models.UsersModel.find({ _id: { $in: ids } }, "e2eePublicKey");
    ack(Object.fromEntries(users.map((u) => [String(u._id), u.e2eePublicKey || null])));
  });

  socket.on("tutorialDone", async () => {
    await models.UsersModel.findByIdAndUpdate(profile._id, { showTutorial: false });
    socket.to(userRoom(selfId)).emit("tutorialDone");
  });

  socket.on("blockUser", async ({ id } = {}) => {
    if (!isId(id) || id === selfId) return;
    await updateSelf({ $addToSet: { blocked: id } });
    socket.emit("blocked", profile.blocked.map(String));
  });

  socket.on("unblockUser", async ({ id } = {}) => {
    if (!isId(id)) return;
    await updateSelf({ $pull: { blocked: id } });
    socket.emit("blocked", profile.blocked.map(String));
  });

  socket.on("pinMessage", async ({ id, cid } = {}) => {
    if (!inChat(cid) || !isId(id)) return;
    const chat = await models.ChatsModel.findById(cid);
    if (!chat || (chat.type === "group" && !(await canPerform(chat, "pinMessages")))) return;
    if (!(await models.MessagesModel.exists({ _id: id, chat: cid }))) return;
    if (!chat.pinned.some((p) => sameId(p, id))) {
      if (chat.pinned.length >= MAX_PINS) {
        socket.emit("chatError", { message: `You can pin up to ${MAX_PINS} messages. Unpin one first.` });
        return;
      }
      chat.pinned.push(id);
      await chat.save();
    }
    io.to(cid).emit("chat", { type: "chats", chats: [chat] });
  });

  socket.on("unpinMessage", async ({ id, cid } = {}) => {
    if (!inChat(cid) || !isId(id)) return;
    const chat = await models.ChatsModel.findById(cid);
    if (!chat || (chat.type === "group" && !(await canPerform(chat, "pinMessages")))) return;
    chat.pinned = chat.pinned.filter((p) => !sameId(p, id));
    await chat.save();
    io.to(cid).emit("chat", { type: "chats", chats: [chat] });
  });

  socket.on("reactMessage", async ({ id, cid, emoji } = {}) => {
    if (!inChat(cid) || !isId(id) || typeof emoji !== "string" || !emoji || emoji.length > 16) return;
    const message = await models.MessagesModel.findOne({ _id: id, chat: cid });
    if (!message) return;
    const entry = message.reactions.find((r) => r.emoji === emoji);
    if (entry) {
      const idx = entry.users.findIndex((u) => sameId(u, selfId));
      if (idx !== -1) entry.users.splice(idx, 1);
      else entry.users.push(profile._id);
    } else {
      if (message.reactions.length >= MAX_REACTIONS_PER_MESSAGE) return;
      message.reactions.push({ emoji, users: [profile._id] });
    }
    message.reactions = message.reactions.filter((r) => r.users.length > 0);
    message.markModified("reactions");
    await message.save();
    io.to(cid).emit("reactMessage", { id: message._id, mid: message.mid, cid, reactions: message.reactions });
  });

  socket.on("deleteChat", async ({ id } = {}) => {
    if (!inChat(id)) return;
    const chat = await models.ChatsModel.findById(id);
    if (!chat || chat.type !== "group" || !isChatOwner(chat)) return;
    await purgeChat(id, io);
  });

  socket.on("deleteMessage", async ([mid, id, cid] = []) => {
    // A pending message that never reached the server only exists locally.
    if (!isId(id)) {
      socket.emit("deleteMessage", [id, mid, cid]);
      return;
    }
    if (!inChat(cid)) return;
    const [message, chat] = await Promise.all([
      models.MessagesModel.findOne({ _id: id, chat: cid }),
      models.ChatsModel.findById(cid),
    ]);
    if (!message) {
      socket.emit("deleteMessage", [id, mid, cid]);
      return;
    }
    const allowed = sameId(message.uid, selfId) || (chat && chat.type === "group" && isChatAdmin(chat));
    if (!allowed) {
      socket.emit("messageError", { event: "deleteMessage", message: "You can only delete your own messages." });
      return;
    }
    await message.deleteOne();
    (message.attachments || []).forEach((a) => removeUpload(a.src));
    if (chat) {
      const wasPinned = chat.pinned.some((p) => sameId(p, id));
      const wasLast = chat.lastMessage && sameId(chat.lastMessage._id, id);
      if (wasPinned) await models.ChatsModel.findByIdAndUpdate(cid, { $pull: { pinned: id } });
      const updated = wasLast ? await refreshLastMessage(cid) : wasPinned ? await models.ChatsModel.findById(cid) : null;
      if (updated) io.to(cid).emit("chat", { type: "chats", chats: [updated] });
    }
    io.to(cid).emit("deleteMessage", [id, message.mid, cid]);
  });

  socket.on("editMessage", async ({ id, cid, content, e2ee } = {}) => {
    if (!inChat(cid) || !isId(id)) return;
    if (e2ee ? !isEnvelope(e2ee) : typeof content !== "string" || !content.trim()) return;
    if (!e2ee && content.length > MAX_MESSAGE_LENGTH) {
      socket.emit("messageError", { event: "editMessage", message: "That message is too long." });
      return;
    }
    const message = await models.MessagesModel.findOne({ _id: id, chat: cid });
    if (!message || !sameId(message.uid, selfId)) return;
    const editWindowMs = 15 * 60 * 1000;
    if (Date.now() - new Date(message.createdAt).getTime() > editWindowMs) {
      socket.emit("messageError", { event: "editMessage", message: "Messages can only be edited for 15 minutes." });
      return;
    }
    message.content = e2ee ? "" : cleanText(content, MAX_MESSAGE_LENGTH);
    message.e2ee = e2ee || null;
    message.edited = true;
    await message.save();
    const chat = await models.ChatsModel.findById(cid, "lastMessage");
    if (chat && chat.lastMessage && sameId(chat.lastMessage._id, message._id)) {
      await updateLastMessage(cid, message);
    }
    io.to(cid).emit("editMessage", { id: message._id, mid: message.mid, cid, uid: message.uid, content: message.content, e2ee: message.e2ee, edited: true });
  });

  socket.on("toggleStar", async ({ id } = {}) => {
    if (!isId(id)) return;
    const already = profile.starred.some((s) => sameId(s, id));
    if (already) {
      await updateSelf({ $pull: { starred: id } });
    } else {
      const message = await models.MessagesModel.findById(id, "chat");
      if (!message || !inChat(message.chat.toString())) return;
      await updateSelf({ $addToSet: { starred: id } });
    }
    socket.emit("starred", profile.starred.map(String));
  });

  socket.on("getStarred", async () => {
    const messages = await models.MessagesModel.find({ _id: { $in: profile.starred }, chat: { $in: memberChatIds() } }).sort({ createdAt: -1 });
    socket.emit("starred", profile.starred.map(String));
    socket.emit("starredMessages", messages);
  });

  socket.on("leaveChat", async ({ id, del } = {}) => {
    if (!inChat(id)) {
      socket.emit("leaveChat", [id, del]);
      return;
    }
    const chat = await models.ChatsModel.findById(id);
    await updateSelf({ $pull: { Chats: id, mutedChats: { chat: id } } });
    if (chat && chat.type === "private") {
      // Removing a DM only hides it for this person: the other side keeps
      // the history, and it's only purged once nobody has it listed.
      const stillListed = await models.UsersModel.exists({ _id: { $in: chat.users }, Chats: chat._id });
      if (!stillListed) await purgeChat(id, io);
    } else if (chat) {
      const updated = await models.ChatsModel.findByIdAndUpdate(id, { $pull: { users: profile._id, admins: profile._id } }, { new: true });
      if (!updated.users.length) {
        await purgeChat(id, io);
      } else if (chat.owner && sameId(chat.owner, selfId)) {
        updated.owner = updated.admins[0] || updated.users[0];
        updated.admins.addToSet(updated.owner);
        await updated.save();
      }
      if (updated.users.length) socket.to(id).emit("chat", { type: "chats", chats: [updated] });
    }
    removeFromRoom(selfId, id);
    io.to(userRoom(selfId)).emit("leaveChat", [id, del]);
  });

  socket.on("muteChat", async ({ id, durationMs } = {}) => {
    if (!inChat(id)) return;
    const mutedUntil = durationMs === null
      ? new Date("2099-12-31T23:59:59.999Z")
      : new Date(Date.now() + Math.max(0, Number(durationMs) || 0));
    await updateSelf({ $pull: { mutedChats: { chat: id } } });
    await updateSelf({ $push: { mutedChats: { chat: id, mutedUntil } } });
    io.to(userRoom(selfId)).emit("muteState", { cid: id, mutedUntil });
  });

  socket.on("unmuteChat", async (id) => {
    if (!isId(id)) return;
    await updateSelf({ $pull: { mutedChats: { chat: id } } });
    io.to(userRoom(selfId)).emit("muteState", { cid: id, mutedUntil: null });
  });

  socket.on("markSeen", async ({ cid } = {}) => {
    if (!inChat(cid)) return;
    const chat = await models.ChatsModel.findById(cid, "lastMessage");
    await models.ReadPositionsModel.findOneAndUpdate(
      { user: profile._id, chat: cid },
      { $set: { lastReadMid: chat && chat.lastMessage ? chat.lastMessage.mid : -1, lastReadAt: new Date() } },
      { upsert: true }
    );
    const result = await models.MessagesModel.updateMany(
      { chat: cid, uid: { $ne: profile._id }, status: { $ne: "✔✔" } },
      { $set: { status: "✔✔" } }
    );
    if (result.modifiedCount > 0) io.to(cid).emit("messagesSeen", { cid, uid: selfId });
    io.to(userRoom(selfId)).emit("chatRead", { cid });
  });

  socket.on("chats", async (stream) => {
    const chatIds = memberChatIds();
    if (stream.type === "sync") {
      // Manifest handshake: only send full docs for chats that changed or
      // have unread messages; everything else is already right on the client.
      const known = stream.known && typeof stream.known === "object" ? stream.known : {};
      const serverChats = await models.ChatsModel.find({ _id: { $in: chatIds } });
      const readPositions = await models.ReadPositionsModel.find({ user: profile._id, chat: { $in: chatIds } });
      const readByChat = new Map(readPositions.map((r) => [r.chat.toString(), r.lastReadMid]));

      const changed = [];
      for (const chat of serverChats) {
        const cid = chat._id.toString();
        const lastReadMid = readByChat.has(cid) ? readByChat.get(cid) : -1;
        // mid is one sequence shared by every chat, so a difference between
        // two mids says nothing about this chat - the rows must be counted.
        const unreadCount = chat.lastMessage && chat.lastMessage.mid > lastReadMid
          ? await models.MessagesModel.countDocuments({ chat: cid, mid: { $gt: lastReadMid }, uid: { $ne: profile._id } })
          : 0;
        const knownAt = known[cid];
        const isStale = !knownAt || new Date(knownAt).getTime() < chat.updatedAt.getTime();
        if (isStale || unreadCount > 0) changed.push({ ...chat.toObject(), unreadCount, lastReadMid });
      }
      const live = new Set(chatIds);
      const removedIds = Object.keys(known).filter((id) => !live.has(id));
      socket.emit("chat", { type: "sync", changed, removedIds });
      return;
    }
    const data = await models.ChatsModel.find({ _id: { $in: chatIds } });
    socket.emit("chat", { type: stream.type, chats: data, target: stream.target });
  });

  socket.on("messages", async (stream) => {
    if (!stream || !inChat(stream.cid)) return;
    const cursorMid = typeof stream.cursorMid === "number" ? stream.cursorMid : null;
    const match = { chat: new ObjectID(stream.cid) };
    const limit = stream.mode === "after" ? 100 : 30;
    let sort;
    if (stream.mode === "after") {
      // Eager catch-up, capped so one busy chat can't drag in thousands of
      // rows on reconnect; anything beyond is reachable by scrolling up.
      if (cursorMid != null) match.mid = { $gt: cursorMid };
      sort = { mid: 1 };
    } else {
      if (cursorMid != null) match.mid = { $lt: cursorMid };
      sort = { mid: -1 };
    }

    let data = await models.MessagesModel.aggregate([
      { $match: match },
      { $sort: sort },
      { $limit: limit + 1 },
      { $lookup: { from: "messages", localField: "reply_to", foreignField: "_id", as: "replyToMessage" } },
      { $unwind: { path: "$replyToMessage", preserveNullAndEmptyArrays: true } },
    ]);
    const hasMore = data.length > limit;
    data = data.slice(0, limit);
    if (sort.mid === -1) data.reverse();
    data.forEach(replyStaysInChat);

    // Always respond, even with an empty list: the client marks a chat
    // loaded (and stops its spinner) only when this event arrives.
    socket.emit("messages", { id: stream.cid, mode: stream.mode, data, hasMore });
  });

  socket.on("updateProfile", async (stream) => {
    const changes = {};
    if (typeof stream.about === "string") {
      changes.about = cleanText(stream.about, 300);
      profile.about = changes.about;
    }
    if (typeof stream.name === "string" && stream.name.trim()) {
      changes.name = cleanText(stream.name.trim(), 60);
      profile.name = changes.name;
    }
    if (typeof stream.username === "string" && stream.username !== profile.username) {
      const username = stream.username.trim().replace(/^@/, "");
      if (!USERNAME_RE.test(username)) {
        socket.emit("profileError", { message: "Usernames are 3-30 letters, numbers, dots or underscores." });
        return;
      }
      const taken = await models.UsersModel.exists({
        _id: { $ne: profile._id },
        username: new RegExp(`^${escapeRegex(username)}$`, "i"),
      });
      if (taken) {
        socket.emit("profileError", { message: "That username is already taken." });
        return;
      }
      changes.username = username;
      profile.username = username;
    }
    if (stream.img && stream.file) {
      const oldSrc = profile.img && profile.img.src;
      const saved = await saveUpload(stream.file, stream.img.type, stream.img.name, selfId);
      if (saved) {
        if (oldSrc && oldSrc !== saved.src) removeUpload(oldSrc);
        profile.img = saved;
        changes.img = saved;
      } else {
        socket.emit("profileError", { message: "That image couldn't be used. Try a JPG, PNG or WEBP under 2MB." });
      }
    }
    await profile.save();
    changes._id = profile._id;
    changes.updatedAt = profile.updatedAt;
    io.to(userRoom(selfId)).emit("profile", safeSelf(profile));
    // socket.to (not io.to): the caller is already covered by the personal
    // room above, and a second copy here would lack the private fields.
    memberChatIds().forEach((id) => socket.to(id).emit("profile", changes));
  });

  socket.on("pushSubscribe", async (subscription) => {
    const { endpoint, keys } = subscription || {};
    if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1024) return;
    if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return;
    await models.PushSubscriptionsModel.findOneAndUpdate(
      { endpoint },
      { user: profile._id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      { upsert: true }
    );
  });

  socket.on("pushUnsubscribe", async ({ endpoint } = {}) => {
    if (typeof endpoint !== "string") return;
    await models.PushSubscriptionsModel.deleteOne({ endpoint, user: profile._id });
  });

  socket.on("updateChat", async (stream) => {
    if (!stream || !inChat(stream.cid)) return;
    const chat = await models.ChatsModel.findById(stream.cid);
    if (!chat || chat.type !== "group" || !(await canPerform(chat, "editInfo"))) return;

    if (typeof stream.name === "string" && stream.name.trim()) chat.name = cleanText(stream.name.trim(), 80);
    if (typeof stream.about === "string") chat.about = cleanText(stream.about, 300);
    if (typeof stream.username === "string" && stream.username !== chat.username) {
      if (!USERNAME_RE.test(stream.username)) {
        socket.emit("chatError", { message: "Group handles are 3-30 letters, numbers, dots or underscores." });
        return;
      }
      chat.username = stream.username;
    }
    if (stream.img && stream.file) {
      const oldSrc = chat.img && chat.img.src;
      const img = await saveUpload(stream.file, stream.img.type, stream.img.name, selfId);
      if (img) {
        removeUpload(oldSrc);
        chat.img = img;
      }
    }
    try {
      await chat.save();
    } catch (err) {
      if (err.code === 11000) {
        socket.emit("chatError", { message: "That handle is already taken." });
        return;
      }
      throw err;
    }
    io.to(chat._id.toString()).emit("chat", { type: "chats", chats: [chat] });
  });

  socket.on("setDisappearing", async ({ cid, duration } = {}) => {
    if (!inChat(cid)) return;
    const chat = await models.ChatsModel.findById(cid);
    if (!chat || (chat.type === "group" && !(await canPerform(chat, "editInfo")))) return;
    chat.disappearingDuration = DISAPPEARING_DURATIONS.includes(duration) ? duration : null;
    await chat.save();
    io.to(cid).emit("chat", { type: "chats", chats: [chat] });
  });

  socket.on("refreshLastMessage", async ({ cid } = {}) => {
    if (!inChat(cid)) return;
    const chat = await refreshLastMessage(cid);
    if (chat) io.to(cid).emit("chat", { type: "chats", chats: [chat] });
  });

  socket.on("removeUser", async ({ chatID, userID: targetId } = {}) => {
    if (!inChat(chatID) || !isId(targetId) || targetId === selfId) return;
    const chat = await models.ChatsModel.findById(chatID);
    if (!chat || chat.type !== "group" || !isChatAdmin(chat)) return;
    // Nobody can remove the owner, and only the owner can remove an admin.
    if (chat.owner && sameId(chat.owner, targetId)) return;
    if ((chat.admins || []).some((a) => sameId(a, targetId)) && !isChatOwner(chat)) return;
    const updated = await models.ChatsModel.findByIdAndUpdate(chatID, { $pull: { users: targetId, admins: targetId } }, { new: true });
    await models.UsersModel.findByIdAndUpdate(targetId, { $pull: { Chats: chatID } });
    removeFromRoom(targetId, chatID);
    io.to(userRoom(targetId)).emit("leaveChat", [chatID, false]);
    io.to(chatID).emit("chat", { type: "chats", chats: [updated] });
  });

  socket.on("promoteUser", async ({ chatID, userID: targetId } = {}) => {
    if (!inChat(chatID) || !isId(targetId)) return;
    const chat = await models.ChatsModel.findById(chatID);
    if (!chat || !isChatOwner(chat) || !chat.users.some((u) => sameId(u, targetId))) return;
    const updated = await models.ChatsModel.findByIdAndUpdate(chatID, { $addToSet: { admins: targetId } }, { new: true });
    io.to(chatID).emit("chat", { type: "chats", chats: [updated] });
  });

  socket.on("demoteUser", async ({ chatID, userID: targetId } = {}) => {
    if (!inChat(chatID) || !isId(targetId)) return;
    const chat = await models.ChatsModel.findById(chatID);
    if (!chat || !isChatOwner(chat)) return;
    const updated = await models.ChatsModel.findByIdAndUpdate(chatID, { $pull: { admins: targetId } }, { new: true });
    io.to(chatID).emit("chat", { type: "chats", chats: [updated] });
  });

  socket.on("getPermissions", async ({ cid } = {}) => {
    if (!inChat(cid)) return;
    const chat = await models.ChatsModel.findById(cid);
    if (!chat) return;
    socket.emit("permissions", { cid, permission: await resolvePermissions(chat) });
  });

  socket.on("updatePermissions", async ({ cid, permissions } = {}) => {
    if (!inChat(cid) || !permissions || typeof permissions !== "object") return;
    const chat = await models.ChatsModel.findById(cid);
    if (!chat || chat.type !== "group" || !isChatAdmin(chat)) return;
    const update = {};
    for (const key of Object.keys(PERMISSION_DEFAULTS)) {
      if (permissions[key] === "everyone" || permissions[key] === "admins") update[key] = permissions[key];
    }
    const merged = { ...(await resolvePermissions(chat)), ...update };
    if (chat.permissions) {
      await models.PermissionsModel.findByIdAndUpdate(chat.permissions, { permission: merged });
    } else {
      const perm = await models.PermissionsModel.create({ permission: merged });
      chat.permissions = perm._id;
      await chat.save();
    }
    io.to(cid).emit("permissions", { cid, permission: merged });
  });

  socket.on("contacts", async () => {
    const fresh = await models.UsersModel.findById(profile._id, "contacts");
    socket.emit("contacts", ((fresh && fresh.contacts) || []).map(String));
  });

  // Other people only ever get the public projection: this event used to
  // return the whole document, password hash and chat ids included.
  socket.on("getProfile", async ({ uid } = {}) => {
    if (!isId(uid)) return;
    if (uid === selfId) {
      const fresh = await models.UsersModel.findById(uid);
      if (fresh) socket.emit("profile", safeSelf(fresh));
      return;
    }
    const user = await models.UsersModel.findById(uid, PUBLIC_PROFILE_FIELDS);
    if (user) socket.emit("profile", user);
  });

  socket.on("createChatPrivate", async (stream) => {
    try {
      const reject = (reason, message) => {
        socketLog("createChatPrivate:rejected", { targetId: stream && stream.cid, reason });
        socket.emit("messageError", { event: "createChatPrivate", replace: stream && stream.replace, message });
      };
      if (!stream || !isId(stream.cid)) return reject("bad id", "User not found");
      const user = await models.UsersModel.findById(stream.cid);
      if (!user) return reject("target not found", "User not found");
      const isSelf = sameId(user._id, selfId);
      if (user.blocked.some((b) => sameId(b, selfId))) return reject("blocked by target", "This user cannot receive messages from you");
      if (profile.isDemo && !isSelf && !user.isDemo && !DEMO_CONTACT_EMAIL_RE.test(user.email)) {
        return reject("demo restriction", "Demo accounts can only message other demo users.");
      }

      // A "message yourself" chat is a genuine [id, id] array. It needs an
      // exact match: $all:[me,me] is satisfied by every DM containing me, and
      // would file a private note in someone else's conversation.
      let data = await models.ChatsModel.findOne({
        type: "private",
        users: isSelf ? [profile._id, profile._id] : { $size: 2, $all: [profile._id, user._id] },
      });
      if (!data) {
        data = new models.ChatsModel({ users: [profile._id, user._id], type: "private", isDemo: !!profile.isDemo });
        await data.save();
      }
      const cid = data._id.toString();
      // Both sides, unconditionally: the recipient of a first DM needs this
      // or they never see the chat. $addToSet keeps it idempotent.
      await updateSelf({ $addToSet: isSelf ? { Chats: data._id } : { Chats: data._id, contacts: user._id } });
      addToRoom(selfId, cid);
      socket.emit(`private.${stream.cid}`, data);
      if (!isSelf) {
        await models.UsersModel.findByIdAndUpdate(user._id, { $addToSet: { Chats: data._id, contacts: profile._id } });
        addToRoom(user._id, cid);
        io.to(userRoom(user._id)).emit("chat", { type: "chats", chats: [data] });
      }
      // A file-only first message has falsy content, so check attachments too.
      if (stream.content || stream.e2ee || (Array.isArray(stream.attachments) && stream.attachments.length)) {
        await SendMessage({
          content: stream.content,
          e2ee: stream.e2ee,
          cid,
          reply_to: stream.reply_to,
          attachments: stream.attachments,
          replace: stream.replace,
        });
      }
    } catch (err) {
      console.error("[socket] createChatPrivate:failed", err);
      socket.emit("messageError", { event: "createChatPrivate", replace: stream && stream.replace, message: "Could not create the conversation" });
    }
  });

  socket.on("createChat", async (stream) => {
    try {
      if (!stream || typeof stream !== "object") {
        socket.emit("chatError", { message: "Invalid group details." });
        return;
      }
      const requested = Array.isArray(stream.members) ? [...new Set(stream.members.filter(isId))].slice(0, MAX_GROUP_MEMBERS) : [];
      if (profile.isDemo && requested.length) {
        socket.emit("chatError", { message: "Demo accounts cannot create groups with members." });
        return;
      }
      // You can only add your contacts, and never someone who blocked you.
      const fresh = await models.UsersModel.findById(profile._id, "contacts");
      const contacts = new Set(((fresh && fresh.contacts) || []).map(String));
      const allowed = await models.UsersModel.find({
        _id: { $in: requested.filter((id) => contacts.has(id)) },
        blocked: { $ne: profile._id },
      }, "_id");
      const users = [selfId, ...allowed.map((u) => u._id.toString()).filter((id) => id !== selfId)];
      const data = new models.ChatsModel({
        name: cleanText(stream.name, 80).trim(),
        users,
        type: "group",
        owner: profile._id,
        admins: [profile._id],
        isDemo: !!profile.isDemo,
      });
      let chat = await data.save();
      const img = await saveUpload(stream.file, stream.type, stream.imgName, selfId);
      if (img) {
        chat.img = img;
        chat = await chat.save();
      }
      const cid = chat._id.toString();
      await models.UsersModel.updateMany({ _id: { $in: users } }, { $addToSet: { Chats: chat._id } });
      await updateSelf({ $addToSet: { Chats: chat._id } });
      users.forEach((id) => addToRoom(id, cid));
      io.to(cid).emit("chat", { type: "chats", chats: [chat] });
    } catch (error) {
      console.error("[socket] createChat:failed", error);
      socket.emit("chatError", { message: "Unable to create the group right now." });
    }
  });
}

module.exports = { onConnection, authenticateSocket };
