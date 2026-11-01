import MessageDialog from "./MessageDialog/MessageDialog.jsx";
import ChatDialog from "./ChatsDialog/ChatDialog.jsx";
import {
  useState,
  useEffect,
  useRef,
  createContext,
  useCallback,
  useContext,
  Suspense,
  lazy,
} from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { apiOrigin } from "../../apiOrigin";
import { captureAuthTokenFromUrl, captureInviteFromUrl, clearStoredAuthToken, getStoredAuthToken, takeInvite } from "../../socketAuthToken";
import { useToast } from "../ui/Toast";
import { readAllDrafts, persistDrafts } from "../../drafts";
import { clearLocalData } from "../../session";
import { createE2ee, LOCKED_TEXT } from "../../e2ee/engine";
const CallOverlay = lazy(() => import("./CallOverlay"));
const Tutorial = lazy(() => import("./Tutorial"));
// Tokens last 12 hours; replacing them at 6 keeps a long-lived tab covered.
const MEDIA_TOKEN_REFRESH_MS = 6 * 60 * 60 * 1000;
const Context = createContext();

function ChatScreen(props) {
  const toast = useToast();
  const [profiles, setProfiles] = useState({});
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const [chatID, setChatID] = useState({ id: false, type: null });
  const chatIDRef = useRef(chatID);
  useEffect(() => {
    chatIDRef.current = chatID;
  }, [chatID]);
  const [Messages, setMessages] = useState({});
  // The socket listeners below are registered once, so they must read
  // current state through refs rather than their captured first render.
  const messagesRef = useRef(Messages);
  messagesRef.current = Messages;
  const requestedProfiles = useRef(new Set());
  const hasMoreHistory = useRef({});
  const resyncInterval = useRef(null);
  const [mediaToken, setMediaToken] = useState(null);
  const mediaTokenAt = useRef(0);
  const dbRef = useRef(null);
  const inviteReady = useRef({ authed: false, listening: false });
  const [drafts, setDrafts] = useState(() => readAllDrafts());
  const setDraft = useCallback((chatId, text) => {
    if (!chatId) return;
    setDrafts((prev) => {
      if ((prev[chatId] || "") === (text || "")) return prev;
      const next = { ...prev };
      if (text && text.trim()) next[chatId] = text;
      else delete next[chatId];
      persistDrafts(next);
      return next;
    });
  }, []);
  const [chatdata, setChatdata] = useState({});
  const [contacts, setContacts] = useState(new Set());
  const [starred, setStarred] = useState(new Set());
  const [starredMessages, setStarredMessages] = useState([]);
  const [blocked, setBlocked] = useState(new Set());
  const [mutedChats, setMutedChats] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [messageDialog, setMessageDialog] = useState(0);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [loadedChats, setLoadedChats] = useState(new Set());
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const chatCache = useRef({ query: {}, chats: {} });
  const chatsReadyRef = useRef(false);
  const contactsReadyRef = useRef(false);
  const typingTimers = useRef({});
  // Below this width the chat list and the open conversation are two
  // separate full-screen views (one at a time) instead of a side-by-side
  // split - matches Tailwind's `md` breakpoint, already used elsewhere.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const navigate = useNavigate();
  const userID = useRef(null);
  const privateChats = useRef({});
  const scrollable = useRef(null);
  const socket = useRef(null);
  const markSendFailed = useCallback((replace, message) => {
    toast.error(message || "Your message could not be sent. Please try again.");
    setMessages((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((cid) => {
        if (next[cid]?.[replace]) {
          next[cid] = {
            ...next[cid],
            [replace]: { ...next[cid][replace], status: "!", sendError: message },
          };
        }
      });
      return next;
    });
  }, []);
  const pendingAuth = useRef({ received: false, data: null });
  const e2ee = useRef(null);
  const [e2eeStatus, setE2eeStatus] = useState("loading");
  const [showTutorial, setShowTutorial] = useState(false);
  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    socket.current.emit("tutorialDone");
  }, []);
  useEffect(() => {
    const start = () => setShowTutorial(true);
    window.addEventListener("lavender:start-tour", start);
    return () => window.removeEventListener("lavender:start-tour", start);
  }, []);
  const e2eeReady = useRef(null);
  if (!e2eeReady.current) {
    let resolve;
    e2eeReady.current = new Promise((done) => { resolve = done; });
    e2eeReady.current.resolve = resolve;
  }
  const openMessage = useCallback((message) => {
    if (e2ee.current) return e2ee.current.openMessage(message);
    return message?.e2ee ? { ...message, encrypted: true, locked: true, content: LOCKED_TEXT } : message;
  }, []);
  const openPreview = useCallback((last) => {
    if (e2ee.current) return e2ee.current.openPreview(last);
    return last?.e2ee ? { ...last, locked: true, content: LOCKED_TEXT } : last;
  }, []);
  const recipientsOf = useCallback((cid, type) => (
    type === "user"
      ? [userID.current, cid]
      : (chatCache.current.chats[cid]?.users || []).map(String)
  ), []);
  const sealFields = useCallback(async (cid, type, fields) => {
    await e2eeReady.current;
    return e2ee.current.enqueue(() => e2ee.current.prepare(recipientsOf(cid, type), fields));
  }, [recipientsOf]);
  // Every outgoing message goes through here, so nothing can skip encryption.
  const sendSealed = useCallback(async ({ event, cid, type, replace, reply_to, ...fields }) => {
    try {
      const sealed = await sealFields(cid, type, fields);
      socket.current.emit(event, { cid, replace, reply_to, ...sealed });
    } catch (err) {
      markSendFailed(replace, err.message);
    }
  }, [sealFields, markSendFailed]);
  const requestProfile = useCallback((uid) => {
    if (!uid || requestedProfiles.current.has(String(uid))) return;
    requestedProfiles.current.add(String(uid));
    socket.current.emit("getProfile", { uid: String(uid) });
  }, []);
  const offlineNotified = useRef(false);
  const patchChat = useCallback((cid, patch) => {
    const current = chatCache.current.chats[cid];
    if (!current) return;
    const updated = { ...current, ...patch(current) };
    chatCache.current.chats = { ...chatCache.current.chats, [cid]: updated };
    setChatdata(chatCache.current.chats);
  }, []);
  if (socket.current === null) {
    captureAuthTokenFromUrl();
    captureInviteFromUrl();
    socket.current = io(apiOrigin, {
      withCredentials: true,
      transports: ["websocket"],
      // Connected from the mount effect below, so no event can reach a
      // component React hasn't committed yet.
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 5000,
      auth: (cb) => cb({ token: getStoredAuthToken() }),
    });
    // The server emits auth during the initial handshake. Keep it until the
    // database-backed initialization below has registered the real handler.
    socket.current.on("auth", (data) => {
      if (data) userID.current = data._id;
      pendingAuth.current = { received: true, data };
    });
    socket.current.on("mediaToken", (token) => {
      // Attachment URLs embed the token, so swapping it needlessly would
      // reload every image and restart any video that's playing.
      if (Date.now() - mediaTokenAt.current < MEDIA_TOKEN_REFRESH_MS) return;
      mediaTokenAt.current = Date.now();
      setMediaToken(token);
    });
    // Ended from another device, or this session was revoked.
    socket.current.on("loggedOut", async () => {
      clearStoredAuthToken();
      socket.current.disconnect();
      await clearLocalData(dbRef.current);
      navigate("/auth/signin");
    });
    socket.current.on("inviteJoined", ({ cid }) => {
      toast.success("You joined the group.");
      setMessageDialog(0);
      setChatID({ id: cid, type: "group" });
    });
    socket.current.on("profileError", ({ message }) => toast.error(message));
    socket.current.on("chatError", ({ message }) => toast.error(message));
    socket.current.on("connect", () => {
      if (offlineNotified.current) toast.success("Back online.");
      offlineNotified.current = false;
    });
    socket.current.on("messageError", ({ event, replace, message }) => {
      console.error("[chat] message failed", { event, replace, message });
      markSendFailed(replace, message);
    });
    socket.current.on("tutorialDone", () => setShowTutorial(false));
    socket.current.on("e2eeKeyChanged", ({ publicKey }) => {
      if (e2ee.current) e2ee.current.load(publicKey);
    });
    socket.current.on("connect_error", () => {
      if (offlineNotified.current) return;
      offlineNotified.current = true;
      toast.error("Lavender could not reach the server. We’ll keep trying.");
    });
    socket.current.on("disconnect", (reason) => {
      if (reason !== "io client disconnect" && !offlineNotified.current) {
        offlineNotified.current = true;
        toast.info("You’re offline for a moment. Messages will resume when connected.");
      }
    });
  }

  // Without this, leaving /app (or logging out by a route change) would keep
  // a socket and the resync timer alive behind the sign-in screen.
  useEffect(() => {
    if (socket.current.disconnected) socket.current.connect();
    const refreshMedia = setInterval(() => socket.current.emit("getMediaToken"), MEDIA_TOKEN_REFRESH_MS);
    return () => {
      clearInterval(resyncInterval.current);
      clearInterval(refreshMedia);
      socket.current.disconnect();
    };
  }, []);

  const [db, setDb] = useState(null);
  useEffect(() => {
    if (!db) {
      const openRequest = indexedDB.open("ChatApp", 6);

      openRequest.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Older builds cached other people's full records (password hashes
        // included) and messages with now-outdated attachment paths. Both
        // refill from the server.
        if (event.oldVersion > 0 && event.oldVersion < 6) {
          ["profiles", "messages"].forEach((store) => {
            if (db.objectStoreNames.contains(store)) db.deleteObjectStore(store);
          });
        }
        // Read after the deletions above: objectStoreNames is a snapshot.
        const names = db.objectStoreNames;
        if (!names.contains("meta"))
          db.createObjectStore("meta", { keyPath: "_id" });
        if (!names.contains("chats"))
          db.createObjectStore("chats", { keyPath: "_id" });
        if (!names.contains("profiles"))
          db.createObjectStore("profiles", { keyPath: "_id" });
        if (!names.contains("messages"))
          db.createObjectStore("messages", { keyPath: "_id" });
        // Do not publish the connection here. This callback runs inside the
        // version-change transaction; normal transactions are only safe after
        // the open request reaches onsuccess.
      };

      openRequest.onerror = (event) => {
        console.log("error met:", event.target.error);
      };

      openRequest.onsuccess = async (event) => {
        const openedDb = event.target.result;
        openedDb.onversionchange = () => openedDb.close();
        dbRef.current = openedDb;
        setDb(openedDb);
      };
    } else {
      db.onversionchange = () => db.close();
      const userconn = db
        .transaction("meta", "readwrite")
        .objectStore("meta")
        .get("user");
      let user = {};

      userconn.onsuccess = async (event) => {
        if (event.target.result) {
          user = { ...(event.target.result.data || {}), ...user };
        }
        const user_id = user._id;
        if (user_id) {
          setProfiles({ [user_id]: user });
          userID.current = user_id;
          setMutedChats(Object.fromEntries(
            (user.mutedChats || [])
              .filter((entry) => !entry.mutedUntil || new Date(entry.mutedUntil).getTime() > Date.now())
              .map((entry) => [String(entry.chat), entry.mutedUntil])
          ));
        }

        // Attach onsuccess synchronously, in the same tick as creating each
        // request - an `await` in between (even on a non-promise IDBRequest,
        // which just defers a tick) can let the request's real completion
        // fire before the handler is attached, silently dropping it and
        // leaving chatsLoaded stuck false forever.
        const m = db
            .transaction("messages")
            .objectStore("messages")
            .getAll();

          const c = db.transaction("chats").objectStore("chats").getAll();

          const p = db.transaction("profiles").objectStore("profiles").getAll();

          m.onsuccess = async (event) => {
            const data = event.target.result;

            setMessages((prev) => {
              const store = {};
              data.forEach((message) => {
                if (!store[message.chat]) store[message.chat] = {};
                store[message.chat][message.mid] = message;
              });
              return { ...prev, ...store };
            });
            // A chat with >=1 locally cached message already has history to
            // show - mark it loaded immediately so it skips the spinner and
            // doesn't get blindly re-fetched from the server on every fresh
            // page load, which is what happened before this was seeded here.
            setLoadedChats((prev) => new Set([...prev, ...data.map((message) => message.chat)]));
          };

          c.onsuccess = (event) => {
            const data = event.target.result;
            const store = {};
            data.forEach((chat) => {
              if (chat.type == "private") {
                const other = chat.users.find((uid) => uid != userID.current) ?? userID.current;
                chat.sender = other;
                privateChats.current[other] = chat._id;
              }
              store[chat._id] = chat;
            });
            chatCache.current["chats"] = store;

            socket.current.on(`messages`, async (stream) => {
              if (stream.data) stream.data = await Promise.all(stream.data.map(openMessage));
              // Only a real fetch proves the history is here. A lone live
              // message must not mark the chat loaded, or opening it later
              // would show that one message and never fetch the rest.
              if (stream.mode || stream.replace) setLoadedChats((prev) => new Set(prev).add(stream.id));
              if (stream.mode === "before") hasMoreHistory.current[stream.id] = !!stream.hasMore;
              if (!stream.mode && chatIDRef.current.id !== stream.id) {
                const incoming = (stream.data || []).filter((m) => m.uid != userID.current).length;
                if (incoming) patchChat(stream.id, (chat) => ({ unreadCount: (chat.unreadCount || 0) + incoming }));
              }
              const store = {};
              if (stream.data) {
                let dat = stream.data;
                await Promise.all(
                  dat.map(async (data) => {
                    await db
                      .transaction("messages", "readwrite")
                      .objectStore("messages")
                      .put(data);
                    store[data.mid] = data;
                    requestProfile(data.uid);
                  })
                );
               // console.log("recieved", dat);
                setMessages((prev) => {
                  const store2 = { ...prev };
                  if (stream.replace) {
                    // The first message to a brand-new contact is optimistically
                    // filed under a pseudo chat-id (the other user's _id, since
                    // no chat exists yet - see chatID.type === "user") but the
                    // server only creates the real chat once this message is
                    // sent, so this ack's stream.id is a *different* key than
                    // where the pending message actually lives. Find whichever
                    // bucket holds it (instead of assuming it's store2[stream.id],
                    // which crashed here with "Cannot convert undefined or null
                    // to object" when it didn't exist yet) and migrate it.
                    let sourceKey = store2[stream.id]?.[stream.replace] ? stream.id : null;
                    if (!sourceKey) {
                      sourceKey = Object.keys(store2).find((k) => store2[k]?.[stream.replace]);
                    }
                    if (sourceKey) {
                      // Keeps the React key stable across the pending ->
                      // permanent id swap so the bubble doesn't remount.
                      dat.forEach((message) => { message.clientId = stream.replace; });
                      const migrated = { ...(store2[stream.id] || {}), ...store2[sourceKey] };
                      delete migrated[stream.replace];
                      if (sourceKey !== stream.id) delete store2[sourceKey];
                      store2[stream.id] = migrated;
                      if (sourceKey !== stream.id && chatIDRef.current.id === sourceKey) {
                        setChatID({ id: stream.id, type: "private" });
                      }
                    }
                    db.transaction("messages", "readwrite")
                      .objectStore("messages")
                      .delete(stream.replace);
                  }
                  store2[stream.id] = { ...(store2[stream.id] || {}), ...store };

                  return store2;
                });
              }
            });
            const removeChatLocally = (id) => {
              if (chatIDRef.current.id == id) setChatID({ id: null, type: null });
              setMessages((prev) => {
                const store = { ...prev };
                const keys = Object.keys(store[id] || {});
                keys.forEach((key) => {
                  db.transaction("messages", "readwrite")
                    .objectStore("messages")
                    .delete(key);
                });
                delete store[id];
                //db.transaction("messages","readwrite").objectStore('messages').delete(id);
                return { ...store };
              });
              db.transaction("chats", "readwrite")
                .objectStore("chats")
                .delete(id);
              const messages = Object.values(messagesRef.current[id] || {});
              messages.forEach((message) => {
                const t = db
                  .transaction("messages", "readwrite")
                  .objectStore("messages");
                t.delete(message._id);
              });
              setChatdata((prev) => {
                const data = { ...prev };
                delete data[id];
                return { ...data };
              });
              const remaining = { ...chatCache.current.chats };
              delete remaining[id];
              chatCache.current.chats = remaining;
            };

            socket.current.on("leaveChat", ([id, del]) => {
              removeChatLocally(id);
            });
  
            socket.current.on("deleteMessage", ([id, mid, cid]) => {
              setMessages((prev) => {
                const store = { ...(prev || {}) };
                try {
                  delete store[cid][mid];
                } catch (err) {
                  console.log(err);
                }
                return store;
              });
              db.transaction("messages", "readwrite")
                .objectStore("messages")
                .delete(id);
            });

            socket.current.on("editMessage", async ({ mid, cid, content, edited, e2ee: envelope, uid }) => {
              const opened = await openMessage({ uid, content, e2ee: envelope, attachments: [] });
              setMessages((prev) => {
                const store = { ...(prev || {}) };
                const chatStore = { ...(store[cid] || {}) };
                if (chatStore[mid]) {
                  const updated = {
                    ...chatStore[mid],
                    content: opened.content,
                    e2ee: envelope,
                    edited,
                    locked: !!opened.locked,
                    unreadable: !!opened.unreadable,
                  };
                  chatStore[mid] = updated;
                  db.transaction("messages", "readwrite").objectStore("messages").put(updated);
                }
                store[cid] = chatStore;
                return store;
              });
            });

            socket.current.on("starred", (ids) => {
              const idSet = new Set(ids);
              setStarred(idSet);
              setStarredMessages((prev) => prev.filter((m) => idSet.has(m._id)));
            });

            socket.current.on("starredMessages", async (data) => {
              setStarredMessages(await Promise.all(data.map(openMessage)));
            });

            socket.current.on("blocked", (ids) => {
              setBlocked(new Set(ids));
            });
            socket.current.on("muteState", ({ cid, mutedUntil }) => {
              setMutedChats((prev) => {
                const next = { ...prev };
                if (mutedUntil && new Date(mutedUntil).getTime() > Date.now()) next[cid] = mutedUntil;
                else delete next[cid];
                return next;
              });
            });

            socket.current.on("typing", ({ cid, uid }) => {
              if (uid === userID.current) return;
              const key = `${cid}:${uid}`;
              clearTimeout(typingTimers.current[key]);
              setTypingUsers((prev) => ({
                ...prev,
                [cid]: { ...(prev[cid] || {}), [uid]: true },
              }));
              typingTimers.current[key] = setTimeout(() => {
                setTypingUsers((prev) => {
                  const chatTyping = { ...(prev[cid] || {}) };
                  delete chatTyping[uid];
                  return { ...prev, [cid]: chatTyping };
                });
              }, 3000);
            });

            socket.current.on("messagesSeen", ({ cid }) => {
              setMessages((prev) => {
                const chatStore = { ...(prev[cid] || {}) };
                let changed = false;
                Object.keys(chatStore).forEach((mid) => {
                  const msg = chatStore[mid];
                  if (msg.uid == userID.current && msg.status !== "✔✔") {
                    const updated = { ...msg, status: "✔✔" };
                    chatStore[mid] = updated;
                    db.transaction("messages", "readwrite").objectStore("messages").put(updated);
                    changed = true;
                  }
                });
                if (!changed) return prev;
                return { ...prev, [cid]: chatStore };
              });
            });

            socket.current.on("locationUpdated", ({ cid, mid, lat, lng }) => {
              setMessages((prev) => {
                const chatStore = { ...(prev[cid] || {}) };
                const msg = chatStore[mid];
                if (!msg || !msg.location) return prev;
                const updated = { ...msg, location: { ...msg.location, lat, lng } };
                chatStore[mid] = updated;
                db.transaction("messages", "readwrite").objectStore("messages").put(updated);
                return { ...prev, [cid]: chatStore };
              });
            });

            socket.current.on("locationStopped", ({ cid, mid }) => {
              setMessages((prev) => {
                const chatStore = { ...(prev[cid] || {}) };
                const msg = chatStore[mid];
                if (!msg || !msg.location) return prev;
                const updated = { ...msg, location: { ...msg.location, live: false } };
                chatStore[mid] = updated;
                db.transaction("messages", "readwrite").objectStore("messages").put(updated);
                return { ...prev, [cid]: chatStore };
              });
            });

            socket.current.on("reactMessage", ({ mid, cid, reactions }) => {
              setMessages((prev) => {
                const store = { ...(prev || {}) };
                const chatStore = { ...(store[cid] || {}) };
                if (chatStore[mid]) {
                  const updated = { ...chatStore[mid], reactions };
                  chatStore[mid] = updated;
                  db.transaction("messages", "readwrite").objectStore("messages").put(updated);
                }
                store[cid] = chatStore;
                return store;
              });
            });

            socket.current.on("profile", async (data) => {
              if (data) {
                // Cache-bust (and guard against re-prefixing an already-
                // processed payload - a chat member can receive duplicate
                // "profile" broadcasts, e.g. if they share more than one
                // chat with the updated user, and re-running this on an
                // already-prefixed URL corrupts it into a broken nested one).
                if (data.img && !data.img.src.startsWith(apiOrigin)) data.img.src = `${apiOrigin}/${data.img.src}?t=${new Date(data.updatedAt).getTime()}`;
                setProfiles((prev) => {
                  const obj = { ...prev };
                  obj[data._id] = { ...(obj[data._id] || {}), ...data };
                  // Broadcasts carry only the changed fields, so cache the
                  // merged record rather than overwriting it with a fragment.
                  db.transaction("profiles", "readwrite").objectStore("profiles").put(obj[data._id]);
                  return obj;
                });
              }
            });


            
            socket.current.on("chat", async (datagroup) => {
              let dict = {};
              if (!Array.isArray(user.Chats)) user.Chats = [];
              const chatsList = datagroup.type === "sync" ? datagroup.changed : datagroup.chats;
              await Promise.all(
                (chatsList || []).map(async (data) => {
                  try {
                    // See the "profile" handler above for why this needs cache-busting and the already-prefixed guard.
                    if (data.img && !data.img.src.startsWith(apiOrigin)) data.img.src = `${apiOrigin}/${data.img.src}?t=${new Date(data.updatedAt).getTime()}`;
                    if (data.lastMessage) data.lastMessage = await openPreview(data.lastMessage);
                    // A pushed chat doc has neither the sidebar's profile-derived
                    // fields nor the local unread count, so merge over the cache.
                    const cached = chatCache.current.chats[data._id];
                    if (cached) {
                      const fresh = data;
                      data = { ...cached, ...fresh };
                      if (fresh.unreadCount === undefined) data.unreadCount = cached.unreadCount || 0;
                    }
                    if (data.type == "private") {
                      // A "message yourself" chat has no other member.
                      const other = data.users.find((uid) => uid != userID.current) ?? userID.current;
                      privateChats.current[other] = data._id;
                      data.sender = other;
                      if (profilesRef.current[other]) {
                        const { _id, createdAt, updatedAt, ...profileFields } = profilesRef.current[other];
                        data = { ...data, ...profileFields, ...(other === userID.current ? { name: "Saved Messages" } : {}) };
                      } else requestProfile(other);
                    } else if (datagroup.type == "join") {
                      user.Chats.push(data._id);
                      await db
                        .transaction("meta", "readwrite")
                        .objectStore("meta")
                        .put({ _id: "user", data: user });
                      setProfiles((prev) => {
                        return { ...prev, ...{ [user._id]: user } };
                      });
                      datagroup.type = "chats";
                    } else if ((data.users || []).includes(userID.current) && !user.Chats.includes(data._id)) {
                      // Covers chats we're already a member of but weren't yet reflected
                      // in the cached local profile (e.g. a group we just created).
                      user.Chats.push(data._id);
                      await db
                        .transaction("meta", "readwrite")
                        .objectStore("meta")
                        .put({ _id: "user", data: user });
                      setProfiles((prev) => {
                        return { ...prev, ...{ [user._id]: user } };
                      });
                    }
                    dict[data._id] = data;
                    await db
                      .transaction("chats", "readwrite")
                      .objectStore("chats")
                      .put(data);
                  } catch (err) {
                    // Never let one bad chat's local-cache bookkeeping crash the
                    // whole batch - that used to reject the Promise.all below and
                    // leave chatsLoaded stuck false forever, even though the
                    // server had already responded correctly.
                    console.log("chat processing error", err);
                    dict[data._id] = data;
                  }
                })
              );
              const type = datagroup.type;

              if (type === "sync") {
                (datagroup.removedIds || []).forEach((id) => removeChatLocally(id));
              }

              // Always the same cache key, whichever type of "chat" event this
              // was - previously the initial "upchats" response landed in
              // chatCache.current.upchats while every later single-chat push
              // (rename, pin, etc.) merged into chatCache.current.chats, so
              // the first live update after load silently reverted the whole
              // visible list back to the stale pre-sync snapshot.
              chatCache.current.chats = { ...chatCache.current.chats, ...dict };
              setChatdata(chatCache.current.chats);

              if (type === "sync" || type === "chats" || type === "upchats") {
                chatsReadyRef.current = true;
                setChatsLoaded(true);
              }

              if (type === "sync") {
                // Eager half: for every chat the manifest says has unread
                // messages, pull them immediately without waiting for the
                // user to open that chat. Staggered in small batches so a
                // reconnect after being offline in many chats doesn't fire
                // a burst of simultaneous requests.
                (datagroup.changed || [])
                  // Past the server's 100-row cap this would fetch the oldest
                  // unread rows and leave a gap; opening the chat loads the
                  // newest page instead.
                  .filter((data) => data.unreadCount > 0 && data.unreadCount <= 100)
                  .forEach((data, idx) => {
                    setTimeout(() => {
                      socket.current.emit("messages", { cid: data._id, mode: "after", cursorMid: data.lastReadMid });
                    }, Math.floor(idx / 5) * 150);
                  });
              }
            });

            socket.current.on("contacts", (data) => {
              contactsReadyRef.current = true;
              setContactsLoaded(true);
              setContacts(new Set(data));
              data.forEach(requestProfile);
            });

            // The server resolves the socket's profile asynchronously before
            // registering its own listeners, so a request that arrives in that
            // window is silently dropped with no error on either side - retry
            // a few times with backoff rather than leaving the UI stuck loading.
            const emitUntilAcked = (event, payload, readyRef, attempt = 0) => {
              if (readyRef.current || attempt > 5) return;
              socket.current.emit(event, payload);
              setTimeout(() => emitUntilAcked(event, payload, readyRef, attempt + 1), 1000 * Math.pow(1.5, attempt));
            };
            // { [chatId]: updatedAt } for everything already cached locally,
            // so the server can tell us "you're already current on this one"
            // instead of sending back full docs for chats that haven't changed.
            const buildKnownManifest = () => {
              const known = {};
              Object.values(chatCache.current.chats || {}).forEach((chat) => {
                if (chat && chat._id && chat.updatedAt) known[chat._id] = chat.updatedAt;
              });
              return known;
            };

            emitUntilAcked("chats", { type: "sync", known: buildKnownManifest() }, chatsReadyRef);
            emitUntilAcked("contacts", {}, contactsReadyRef);

            // Nothing previously re-synced on reconnect - any update pushed
            // during a dropped connection was silently missed until a full
            // page reload. Re-run the same manifest handshake whenever the
            // socket comes back, plus a conservative periodic resync as a
            // belt-and-suspenders for updates that can arrive even while the
            // socket never truly disconnects.
            socket.current.io.on("reconnect", () => {
              emitUntilAcked("chats", { type: "sync", known: buildKnownManifest() }, { current: false });
              socket.current.emit("contacts", {});
              if (chatIDRef.current.id) {
                const openMessages = Object.values(messagesRef.current[chatIDRef.current.id] || {});
                const mids = openMessages.map((m) => m.mid).filter((mid) => typeof mid === "number");
                const localMax = mids.length ? Math.max(...mids) : null;
                socket.current.emit("messages", { cid: chatIDRef.current.id, mode: localMax != null ? "after" : "before", cursorMid: localMax });
              }
            });
            socket.current.on("chatRead", ({ cid }) => {
              patchChat(cid, () => ({ unreadCount: 0 }));
            });
            clearInterval(resyncInterval.current);
            resyncInterval.current = setInterval(() => {
              socket.current.emit("chats", { type: "sync", known: buildKnownManifest() });
            }, 5 * 60 * 1000);
            setChatdata(chatCache.current["chats"] || {});
            inviteReady.current.listening = true;
            redeemInvite();
          };

          p.onsuccess = (event) => {
            const data = event.target.result;
            const store = {};
            data.forEach((profile) => {
              store[profile._id] = profile;
            });
            setProfiles((prev) => {
              return { ...(prev || {}), ...store };
            });
          //  console.log("Loaded profiles:", profiles);
          };
      };

      // Needs both a signed-in socket and the "chat" listener above; a session
      // that isn't signed in keeps the invite for after the redirect.
      const redeemInvite = () => {
        if (!inviteReady.current.authed || !inviteReady.current.listening) return;
        const code = takeInvite();
        if (code) socket.current.emit("joinByInvite", { code });
      };

      const handleAuth = async (data) => {
        pendingAuth.current = { received: false, data: null };
        // A session that ended without a logout can leave another account's
        // history cached here - never show it to whoever signs in next.
        if (data && user._id && user._id !== data._id) {
          await clearLocalData(db);
          window.location.reload();
          return;
        }
        user = { ...user, ...data };
        if (data) {
          if (!e2ee.current) {
            e2ee.current = createE2ee({
              socket,
              userId: String(data._id),
              onStatus: setE2eeStatus,
              onKeyChange: (uid) => {
                const name = profilesRef.current[uid]?.name || "A contact";
                toast.error(`${name}'s encryption key changed. Compare safety numbers if this is unexpected.`);
              },
            });
          }
          e2ee.current.load(data.e2eePublicKey || null).finally(() => e2eeReady.current.resolve());
          // A valid new account can have no chats yet. Mark the initial
          // loading phase complete immediately so an empty account renders an
          // empty state instead of an endless spinner while sync finishes.
          setChatsLoaded(true);
          setContactsLoaded(true);
          // See the "profile" handler above for why this needs cache-busting and the already-prefixed guard.
          if (data.img && !data.img.src.startsWith(apiOrigin)) data.img.src = `${apiOrigin}/${data.img.src}?t=${new Date(data.updatedAt).getTime()}`;
          setShowTutorial(!!data.showTutorial);
          if (data.blocked) setBlocked(new Set(data.blocked.map(String)));
          if (data.starred) setStarred(new Set(data.starred.map(String)));
          setMutedChats(Object.fromEntries(
            (data.mutedChats || [])
              .filter((entry) => !entry.mutedUntil || new Date(entry.mutedUntil).getTime() > Date.now())
              .map((entry) => [String(entry.chat), entry.mutedUntil])
          ));
          db.transaction("meta", "readwrite")
            .objectStore("meta")
            .put({ _id: "user", data: user });

          const user_id = user._id;
          setProfiles((prev) => {
            return { ...prev, ...{ [user_id]: user } };
          });
          userID.current = user_id;
          inviteReady.current.authed = true;
          redeemInvite();
        } else {
          socket.current.disconnect();
          navigate("/auth/signin");
        }
      };
      socket.current.on("auth", handleAuth);
      if (pendingAuth.current.received) {
        const data = pendingAuth.current.data;
        pendingAuth.current = { received: false, data: null };
        handleAuth(data);
      }
    }
  }, [db]);

  // Messages that arrived before the key was available are opened once it is.
  const reopening = useRef(new Set());
  useEffect(() => {
    if (e2eeStatus !== "ready" || !db) return;
    Object.entries(Messages).forEach(([cid, store]) => {
      Object.values(store || {}).filter((m) => m.locked && !reopening.current.has(m._id)).forEach(async (message) => {
        reopening.current.add(message._id);
        const opened = await e2ee.current.openMessage(message);
        reopening.current.delete(message._id);
        db.transaction("messages", "readwrite").objectStore("messages").put(opened);
        setMessages((prev) => ({ ...prev, [cid]: { ...(prev[cid] || {}), [opened.mid]: opened } }));
      });
    });
  }, [e2eeStatus, Messages, db]);
  useEffect(() => {
    if (e2eeStatus !== "ready" || !db) return;
    Object.values(chatdata).filter((chat) => chat?.lastMessage?.locked && !reopening.current.has(chat._id)).forEach(async (chat) => {
      reopening.current.add(chat._id);
      const lastMessage = await e2ee.current.openPreview(chat.lastMessage);
      reopening.current.delete(chat._id);
      const updated = { ...chatCache.current.chats[chat._id], lastMessage };
      chatCache.current.chats = { ...chatCache.current.chats, [chat._id]: updated };
      setChatdata(chatCache.current.chats);
      db.transaction("chats", "readwrite").objectStore("chats").put(updated);
    });
  }, [e2eeStatus, chatdata, db]);

  return (
    <Context.Provider
      value={{
        e2ee,
        e2eeStatus,
        openMessage,
        recipientsOf,
        sealFields,
        sendSealed,
        userID,
        profiles,
        socket,
        db,
        chatdata,
        privateChats,
        setChatdata,
        chatsLoaded,
        loadedChats,
        contacts,
        contactsLoaded,
        setChatID,
        setMessages,
        messageDialog,
        setMessageDialog,
        Messages,
        chatCache,
        scrollable,
        chatID,
        chatIDRef,
        requestProfile,
        hasMoreHistory,
        mediaToken,
        drafts,
        setDraft,
        starred,
        starredMessages,
        toggleStar: (id) => socket.current.emit("toggleStar", { id }),
        getStarred: () => socket.current.emit("getStarred", {}),
        blocked,
        mutedChats,
        setMutedChats,
        toggleBlock: (id) =>
          socket.current.emit(blocked.has(id) ? "unblockUser" : "blockUser", { id }),
        report: (id, targetType, reason) =>
          socket.current.emit("report", { id, targetType, reason }),
        typingUsers,
        emitTyping: (cid) => socket.current.emit("typing", { cid }),
        pinMessage: (id, cid) => socket.current.emit("pinMessage", { id, cid }),
        unpinMessage: (id, cid) => socket.current.emit("unpinMessage", { id, cid }),
        reactMessage: (id, cid, emoji) => socket.current.emit("reactMessage", { id, cid, emoji }),
        deleteChat: (id) => socket.current.emit("deleteChat", { id }),
        isMobile,
      }}
    >
      {/* MessageDialog isn't just an open chat - Settings/UserInfo/AddGroup/
          StarredMessages all route through it too via messageDialog !== 0,
          with no chat ever selected. Gating visibility on chatID.id alone
          would hide it (and leave nothing shown) whenever one of those was
          opened from the sidebar on mobile. */}
      <div className="main-app h-screen w-screen flex flex-row overflow-hidden">
        <div className="ambient-petals" aria-hidden="true">
          <div className="bloom-branch bloom-branch-left">
            <span className="branch-stem" />
            <span className="branch-twig twig-one" />
            <span className="branch-twig twig-two" />
            <span className="blossom blossom-one"><i /><i /><i /><i /><b /></span>
            <span className="blossom blossom-two"><i /><i /><i /><i /><b /></span>
            <span className="blossom blossom-three"><i /><i /><i /><i /><b /></span>
          </div>
          <div className="bloom-branch bloom-branch-right">
            <span className="branch-stem" />
            <span className="branch-twig twig-one" />
            <span className="branch-twig twig-two" />
            <span className="blossom blossom-one"><i /><i /><i /><i /><b /></span>
            <span className="blossom blossom-two"><i /><i /><i /><i /><b /></span>
            <span className="blossom blossom-three"><i /><i /><i /><i /><b /></span>
          </div>
          <span className="petal petal-1" />
          <span className="petal petal-2" />
          <span className="petal petal-3" />
          <span className="petal petal-4" />
          <span className="leaf leaf-1" />
          <span className="leaf leaf-2" />
          <span className="leaf leaf-3" />
        </div>
        {(!isMobile || (!chatID.id && messageDialog === 0)) && <ChatDialog />}
        {(!isMobile || chatID.id || messageDialog !== 0) && <MessageDialog />}
      </div>
      <Suspense fallback={null}>
        <CallOverlay socket={socket} />
        {showTutorial && e2eeStatus !== "loading" && <Tutorial onClose={closeTutorial} />}
      </Suspense>
    </Context.Provider>
  );
}
export function useCtx() {
  return useContext(Context);
}
export default ChatScreen;
