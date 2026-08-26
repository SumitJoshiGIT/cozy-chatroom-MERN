import MessageDialog from "./MessageDialog/MessageDialog.jsx";
import ChatDialog from "./ChatsDialog/ChatDialog.jsx";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useMemo,
  useContext,
} from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { apiOrigin } from "../../apiOrigin";
import { captureAuthTokenFromUrl, getStoredAuthToken } from "../../socketAuthToken";
import { readAllDrafts, persistDrafts } from "../../drafts";
const Context = createContext();

function ChatScreen(props) {
  const [profiles, setProfiles] = useState({});
  const [chatID, setChatID] = useState({ id: false, type: null });
  const chatIDRef = useRef(chatID);
  useEffect(() => {
    chatIDRef.current = chatID;
  }, [chatID]);
  const [Messages, setMessages] = useState({});
  const [chatdata, setChatdata] = useState({});
  // A push notification click (or a plain ?chat= link) names a chat id but
  // not its type, and chatID needs both - wait for that chat's data to show
  // up in chatdata (already loaded, or arrives via the normal sync path)
  // before actually switching to it.
  const pendingDeepLinkChat = useRef((() => {
    try { return new URLSearchParams(window.location.search).get("chat"); } catch { return null; }
  })());
  useEffect(() => {
    const handler = (event) => {
      if (event.data && event.data.type === "notificationclick" && event.data.chatId) {
        pendingDeepLinkChat.current = event.data.chatId;
      }
    };
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", handler);
    return () => {
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", handler);
    };
  }, []);
  useEffect(() => {
    const id = pendingDeepLinkChat.current;
    if (id && chatdata[id]) {
      setChatID({ id, type: chatdata[id].type === "group" ? "group" : "private" });
      pendingDeepLinkChat.current = null;
    }
  }, [chatdata]);
  const [contacts, setContacts] = useState(new Set());
  const [starred, setStarred] = useState(new Set());
  const [starredMessages, setStarredMessages] = useState([]);
  const [blocked, setBlocked] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [messageDialog, setMessageDialog] = useState(0);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [loadedChats, setLoadedChats] = useState(new Set());
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const chatCache = useRef({ query: {}, chats: {} });
  const chatsReadyRef = useRef(false);
  const contactsReadyRef = useRef(false);
  const typingTimers = useRef({});
  // Many independent components (every Message row, every sidebar Entity,
  // the "chat"/"messages"/"contacts" handlers below) each notice the same
  // not-yet-cached uid and ask for it - without this, a chat that loads 30
  // messages from an unknown sender fired 30 redundant "getProfile" round
  // trips. Track in-flight uids here and only let the first request through;
  // the "profile" handler below clears an entry once its response lands.
  const pendingProfileRequests = useRef(new Set());
  const requestProfile = useCallback((uid) => {
    if (!uid || profiles[uid] || pendingProfileRequests.current.has(uid)) return;
    pendingProfileRequests.current.add(uid);
    socket.current.emit("getProfile", { uid });
    // The "profile" handler below clears this on a successful response, but
    // a lookup for a uid that no longer exists resolves with a null user -
    // there's nothing to key off then, so this uid would otherwise stay
    // marked in-flight forever. Bound the worst case instead of blocking it.
    setTimeout(() => pendingProfileRequests.current.delete(uid), 8000);
  }, [profiles]);

  // Per-chat unsent composer text, kept in top-level state (not just
  // localStorage) so the sidebar's "Draft: ..." preview updates live as you
  // type, not only after switching away and back.
  const [drafts, setDrafts] = useState(() => readAllDrafts());
  const setDraft = useCallback((chatId, text) => {
    if (!chatId) return;
    setDrafts((prev) => {
      const next = { ...prev };
      if (text) next[chatId] = text;
      else delete next[chatId];
      persistDrafts(next);
      return next;
    });
  }, []);

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
  if (socket.current === null) {
    captureAuthTokenFromUrl();
    socket.current = io(apiOrigin, {
      withCredentials: true,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 4,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000,
      auth: (cb) => cb({ token: getStoredAuthToken() }),
    });
  }

  const [db, setDb] = useState(null);
  useEffect(() => {
    if (!db) {
      console.log("WARNING:");
      const openRequest = indexedDB.open("ChatApp", 5);

      openRequest.onupgradeneeded = (event) => {
        const db = event.target.result;
        const names = db.objectStoreNames;
        if (!names.contains("meta"))
          db.createObjectStore("meta", { keyPath: "_id" });
        if (!names.contains("chats"))
          db.createObjectStore("chats", { keyPath: "_id" });
        if (!names.contains("profiles"))
          db.createObjectStore("profiles", { keyPath: "_id" });
        if (!names.contains("messages"))
          db.createObjectStore("messages", { keyPath: "_id" });
        // Don't setDb() here - the versionchange transaction this callback
        // runs in hasn't committed yet. Setting it here used to trigger a
        // re-render whose effect immediately opened a *second* transaction
        // on the same handle while the first was still active, throwing
        // "A version change transaction is running" for every brand-new
        // user (empty IndexedDB, so onupgradeneeded always fires). onsuccess
        // below always fires after this completes, so it's the only place
        // that needs to set db.
        console.log("IndexedDB has been created or upgraded");
      };

      openRequest.onerror = (event) => {
        console.log("error met:", event.target.error);
      };

      openRequest.onsuccess = async (event) => {
        setDb(event.target.result);
        console.log("Indeasync xedDB has been created");
      };
    } else {
      db.onversionchange = () => db.close();
      const userconn = db
        .transaction("meta", "readwrite")
        .objectStore("meta")
        .get("user");
      let user = {};

      let sessionStarted = false;
      // Runs the full chat-session setup (socket listeners, IndexedDB reads,
      // the initial "chats"/"contacts" sync) exactly once, however the user
      // record first becomes available: from a cached IndexedDB record
      // (returning user, reload) or from the "auth" socket event itself
      // (a brand-new user's very first login, before anything is cached
      // locally). Previously this only ran from the IndexedDB-cache path, so
      // a first-time login - no cached record yet - never registered the
      // "chat" listener or emitted the sync request at all, leaving the
      // chat list spinning forever until a reload populated the cache.
      const startSession = () => {
        if (sessionStarted) return;
        sessionStarted = true;
        {
          const user_id = user._id;
          setProfiles({ [user_id]: user });

          userID.current = user_id;
          console.log("Connected as:", user_id);

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
                chat.users.forEach((uid) => {
                  if (uid != userID.current) data.sender = uid;
                });
              }
              store[chat._id] = chat;
            });
            chatCache.current["chats"] = store;

            socket.current.on(`messages`, async (stream) => {
              setLoadedChats((prev) => new Set(prev).add(stream.id));
              const store = {};
              if (stream.data) {
                let dat = stream.data;
                await Promise.all(
                  dat.map(async (data) => {
                    // Carry the pending message's temp id forward as a stable
                    // React key across the optimistic-to-permanent swap below -
                    // otherwise Message.jsx remounts (its key, message._id,
                    // changes from the temp id to the real one), replaying its
                    // mount-in animation on an element that was already visible.
                    if (stream.replace) data.clientId = stream.replace;
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
              const messages = Object.values(Messages[id] || {});
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

            socket.current.on("editMessage", ({ id, mid, cid, content, edited }) => {
              setMessages((prev) => {
                const store = { ...(prev || {}) };
                const chatStore = { ...(store[cid] || {}) };
                if (chatStore[mid]) {
                  const updated = { ...chatStore[mid], content, edited };
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

            socket.current.on("starredMessages", (data) => {
              setStarredMessages(data);
            });

            socket.current.on("blocked", (ids) => {
              setBlocked(new Set(ids));
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
                pendingProfileRequests.current.delete(data._id);
                // Cache-bust (and guard against re-prefixing an already-
                // processed payload - a chat member can receive duplicate
                // "profile" broadcasts, e.g. if they share more than one
                // chat with the updated user, and re-running this on an
                // already-prefixed URL corrupts it into a broken nested one).
                if (data.img && !data.img.src.startsWith(apiOrigin)) data.img.src = `${apiOrigin}/${data.img.src}?t=${new Date(data.updatedAt).getTime()}`;
                setProfiles((prev) => {
                  const obj = { ...prev };
                  obj[data._id] = { ...(obj[data._id] || {}), ...data };
                  return obj;
                });
                await db
                  .transaction("profiles", "readwrite")
                  .objectStore("profiles")
                  .put(data);
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
                    if (data.type == "private") {
                      const other = data.users.find((uid) => uid != userID.current);
                      // A "message yourself" chat has every entry in `users`
                      // equal to your own id - the loop above never finds an
                      // "other" party, so `sender` (what every downstream
                      // profile/name lookup keys off) was left unset, which
                      // is why this chat rendered as "Unnamed" with no way
                      // to resolve a display name or avatar for it.
                      const uid = other != null ? other : userID.current;
                      privateChats.current[uid] = data._id;
                      data.sender = uid;
                      requestProfile(uid);
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
                  .filter((data) => data.unreadCount > 0)
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
              data.forEach((uid) => requestProfile(uid));
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
                const openMessages = Object.values(Messages[chatIDRef.current.id] || {});
                const localMax = openMessages.length ? Math.max(...openMessages.map((m) => m.mid)) : null;
                socket.current.emit("messages", { cid: chatIDRef.current.id, mode: localMax != null ? "after" : "before", cursorMid: localMax });
              }
            });
            const resyncInterval = setInterval(() => {
              socket.current.emit("chats", { type: "sync", known: buildKnownManifest() });
            }, 5 * 60 * 1000);
            setChatdata(chatCache.current["chats"] || {});
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
        }
      };

      userconn.onsuccess = async (event) => {
        if (event.srcElement.result) {
          user = { ...(event.srcElement.result.data || {}), ...user };
          startSession();
        }
      };

      socket.current.on("auth", async (data) => {
        user = { ...user, ...data };
        if (data) {
          // See the "profile" handler above for why this needs cache-busting and the already-prefixed guard.
          if (data.img && !data.img.src.startsWith(apiOrigin)) data.img.src = `${apiOrigin}/${data.img.src}?t=${new Date(data.updatedAt).getTime()}`;
          if (data.blocked) setBlocked(new Set(data.blocked.map(String)));
          db.transaction("meta", "readwrite")
            .objectStore("meta")
            .put({ _id: "user", data: user });

          const user_id = user._id;
          setProfiles((prev) => {
            return { ...prev, ...{ [user_id]: user } };
          });
          let lastupdated = db
            .transaction("meta")
            .objectStore("meta")
            .get("chat");
          lastupdated.onsuccess = () => {
            console.log("succeded");
          };
          lastupdated.onerror = () => {
            console.log("error");
          };

          console.log(lastupdated);
          userID.current = user_id;
          console.log("Connected as:", user_id);
          // No-op if the IndexedDB-cache path (userconn.onsuccess above)
          // already ran startSession - this is the first-login path, where
          // there was no cached record for it to find.
          startSession();
        } else {
          socket.current.disconnect();
          navigate("/auth/signin");
        }
      });
    }
  }, [db]);

  return (
    <Context.Provider
      value={{
        userID,
        profiles,
        requestProfile,
        drafts,
        setDraft,
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
        starred,
        starredMessages,
        toggleStar: (id) => socket.current.emit("toggleStar", { id }),
        getStarred: () => socket.current.emit("getStarred", {}),
        blocked,
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
      <div className="h-screen w-screen flex flex-row overflow-hidden">
        {(!isMobile || (!chatID.id && messageDialog === 0)) && <ChatDialog />}
        {(!isMobile || chatID.id || messageDialog !== 0) && <MessageDialog />}
      </div>
    </Context.Provider>
  );
}
export function useCtx() {
  return useContext(Context);
}
export default ChatScreen;
