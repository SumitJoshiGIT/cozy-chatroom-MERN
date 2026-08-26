import MessageBar from "./MessageBar/MessageBar";
import Message from "./MessageBar/Message";
import ForwardDialog from "./ForwardDialog";
import ThreadPanel from "./ThreadPanel";
import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from "react";
import { useCtx } from "../AppScreen";
import TitleBar from "./TitleBar/TitleBar";
import background from "/background.jpg";
import icon from "/icon.svg";
import pinIcon from "/pin.svg";
import { getWallpaper, setWallpaperFor } from "../../../wallpaper";
import Spinner from "../../ui/Spinner";
export default function MessageDialog(props) {
  const { Messages, setMessages, chatID, scrollable, socket, chatdata, userID, profiles, db, unpinMessage, loadedChats } = useCtx();
  const [pinIndex, setPinIndex] = useState(0);
  const [reply, setReply] = useState();
  const [edit, setEdit] = useState();
  const [forward, setForward] = useState();
  const [threadRoot, setThreadRoot] = useState(null);
  const [wallpaper, setWallpaper] = useState(() => getWallpaper(chatID.id));
  // Selection mode - the right-click menu's alternative for touch (long-
  // press) and mouse (a hover checkbox) alike. Lives here, not in Message
  // itself, since the TitleBar needs to react to it too.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const selectionMode = selectedIds.size > 0;

  const cancelSelection = useCallback(() => setSelectedIds(new Set()), []);
  const enterSelection = useCallback((id) => setSelectedIds(new Set([id])), []);
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // In-chat search - finds every matching message inside the open chat
  // (server-side, so it isn't limited to whatever's already loaded locally)
  // with next/prev jump navigation, distinct from the sidebar's global
  // "which chat has this" search in SearchBar.jsx.
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatSearchResults, setChatSearchResults] = useState([]);
  const [chatSearchIndex, setChatSearchIndex] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const chatSearchDebounce = useRef(null);
  const chatSearchReqId = useRef(0);
  const pendingJumpRef = useRef(null);
  const highlightTimerRef = useRef(null);
  const pendingPinFetch = useRef(new Set());

  useEffect(() => {
    const handler = (data) => {
      if (data.cid !== chatID.id || data.reqId !== chatSearchReqId.current) return;
      setChatSearchResults(data.results || []);
      setChatSearchIndex(0);
    };
    socket.current.on("searchMessagesInChat", handler);
    return () => socket.current.off("searchMessagesInChat", handler);
  }, [chatID.id]);

  const jumpToMatch = useCallback((match) => {
    if (!match) return;
    const el = document.getElementById(match._id);
    clearTimeout(highlightTimerRef.current);
    if (el) {
      el.scrollIntoView({ block: "center" });
      setHighlightedMessageId(match._id);
      highlightTimerRef.current = setTimeout(() => setHighlightedMessageId(null), 1500);
      pendingJumpRef.current = null;
      return;
    }
    // Not currently loaded (older than what's been paginated in) - fetch a
    // window ending just past this message; the effect below retries the
    // scroll once that batch lands in Messages[chatID.id].
    pendingJumpRef.current = match;
    socket.current.emit("messages", { cid: chatID.id, mode: "before", cursorMid: match.mid + 1 });
  }, [chatID.id]);

  const runChatSearch = useCallback((query) => {
    setChatSearchQuery(query);
    clearTimeout(chatSearchDebounce.current);
    if (!query.trim()) {
      setChatSearchResults([]);
      setChatSearchIndex(0);
      return;
    }
    chatSearchDebounce.current = setTimeout(() => {
      chatSearchReqId.current += 1;
      socket.current.emit("searchMessagesInChat", { cid: chatID.id, query: query.trim(), reqId: chatSearchReqId.current });
    }, 250);
  }, [chatID.id]);

  const goToSearchIndex = useCallback((idx) => {
    if (idx < 0 || idx >= chatSearchResults.length) return;
    setChatSearchIndex(idx);
    jumpToMatch(chatSearchResults[idx]);
  }, [chatSearchResults, jumpToMatch]);

  // Jump to the first (most recent, since results sort ascending by mid -
  // last is most recent) match as soon as a fresh result set lands.
  useEffect(() => {
    if (chatSearchResults.length > 0) jumpToMatch(chatSearchResults[0]);
  }, [chatSearchResults]);

  const toggleChatSearch = useCallback(() => {
    setChatSearchOpen((prev) => {
      if (prev) {
        setChatSearchQuery("");
        setChatSearchResults([]);
        setChatSearchIndex(0);
      }
      return !prev;
    });
  }, []);

  useEffect(() => {
    setWallpaper(getWallpaper(chatID.id));
    cancelSelection();
    setPinIndex(0);
    setChatSearchOpen(false);
    setChatSearchQuery("");
    setChatSearchResults([]);
    setChatSearchIndex(0);
    setHighlightedMessageId(null);
    pendingPinFetch.current.clear();
    setThreadRoot(null);
  }, [chatID.id]);

  const onScroll = useCallback(
    function () {
      if (scrollable.current && scrollable.current.scrollTop < 20) {
        // socket.current.emit('messages',{cid:chatID.id,mid:Messages[chatID.id][0]?Messages[0]._id:null})
      }
    },
    [Messages]
  );

  const m = Messages[chatID.id];
  useEffect(() => {
    if (chatID.id) socket.current.emit("markSeen", { cid: chatID.id });
  }, [chatID.id, m]);

  // Retries a jumpToMatch() that found its target not yet loaded, once the
  // "before" fetch it triggered lands here.
  useEffect(() => {
    const match = pendingJumpRef.current;
    if (!match) return;
    const el = document.getElementById(match._id);
    if (el) {
      el.scrollIntoView({ block: "center" });
      setHighlightedMessageId(match._id);
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightedMessageId(null), 1500);
      pendingJumpRef.current = null;
    }
  }, [m]);

  // Lazy load: only fetch a chat's history once it's actually opened, and
  // only if we don't already have it - a chat with unread messages already
  // got caught up eagerly via the sync-manifest handshake in AppScreen, so
  // this effect only fires for a chat that's genuinely never been loaded on
  // this device (first open, or a cleared local cache).
  // chatID.type === "user" means there's no chat yet (first message to a
  // contact) - chatID.id is the other user's _id, not a chat _id, so it can
  // never appear in chatSet server-side or in loadedChats client-side. Emitting
  // "messages" for it is pointless (server silently no-ops, not a chat member),
  // and treating it as perpetually loading hid the message list (and the
  // pending-message row whose mount is what actually sends the message).
  useEffect(() => {
    if (!chatID.id || chatID.type === "user" || loadedChats.has(chatID.id)) return;
    socket.current.emit("messages", { cid: chatID.id, mode: "before", cursorMid: null });
  }, [chatID.id]);

  const messagesLoading = !!chatID.id && chatID.type !== "user" && !loadedChats.has(chatID.id);
  const chat = chatdata[chatID.id] || {};
  const canPin = chat.type !== 'group' || (chat.admins||[]).includes(userID.current) || chat.owner===userID.current;

  const messagesById = useMemo(() => {
    const byId = {};
    if (m) Object.values(m).forEach((message) => { byId[message._id] = message; });
    return byId;
  }, [m]);

  // Threads aren't a separate data model - a message "has a thread" simply
  // because at least one other (locally loaded) message's reply_to points
  // at it. This can undercount vs. the server's authoritative getThread
  // result for a message whose replies haven't been paginated in yet, but
  // that's fine here - it's only used to decide whether to show a "N
  // replies" affordance at all, and ThreadPanel always fetches the real
  // count once opened.
  const replyCounts = useMemo(() => {
    const counts = {};
    if (m) Object.values(m).forEach((message) => {
      if (message.reply_to) counts[message.reply_to] = (counts[message.reply_to] || 0) + 1;
    });
    return counts;
  }, [m]);

  const threadMessageProps = useMemo(() => ({
    setDialog: props.setDialog,
    infoPanel: props.infoPanel,
    setReply,
    setEdit,
    setForward,
    jumpToMessage: jumpToMatch,
  }), [props.setDialog, props.infoPanel, jumpToMatch]);

  const selectedMessages = useMemo(
    () => Array.from(selectedIds).map((id) => messagesById[id]).filter(Boolean),
    [selectedIds, messagesById]
  );

  const deleteSelected = useCallback(() => {
    selectedMessages.forEach((message) => {
      socket.current.emit("deleteMessage", [message.mid, message._id, message.chat]);
    });
    cancelSelection();
  }, [selectedMessages, socket, cancelSelection]);

  const copySelected = useCallback(() => {
    const text = selectedMessages.map((message) => message.content).filter(Boolean).join("\n");
    if (text) navigator.clipboard.writeText(text);
    cancelSelection();
  }, [selectedMessages, cancelSelection]);

  const forwardSelected = useCallback(() => {
    setForward(selectedMessages);
    cancelSelection();
  }, [selectedMessages, cancelSelection]);

  const pinnedIds = chat.pinned || [];
  const activePinIndex = pinnedIds.length ? Math.min(pinIndex, pinnedIds.length - 1) : 0;
  const activePinned = pinnedIds.length ? messagesById[pinnedIds[activePinIndex]] : null;

  // A pinned message is very often older than whatever's currently
  // lazy-loaded (that's the point of pinning something for later) - without
  // this, activePinned above resolves to undefined and the whole pin bar
  // silently fails to render, with no indication anything is pinned at all.
  useEffect(() => {
    if (!chatID.id || chatID.type === "user" || pinnedIds.length === 0) return;
    const missing = pinnedIds.filter((id) => !messagesById[id] && !pendingPinFetch.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => pendingPinFetch.current.add(id));
    socket.current.emit("getMessagesByIds", { cid: chatID.id, ids: missing });
  }, [chatID.id, pinnedIds.join(","), messagesById]);

  useEffect(() => {
    const handler = ({ cid, results }) => {
      if (cid !== chatID.id || !results || !results.length) return;
      results.forEach((msg) => pendingPinFetch.current.delete(msg._id.toString()));
      setMessages((prev) => {
        const chatStore = { ...(prev[cid] || {}) };
        results.forEach((msg) => { chatStore[msg.mid] = msg; });
        return { ...prev, [cid]: chatStore };
      });
      if (db) {
        results.forEach((msg) => db.transaction("messages", "readwrite").objectStore("messages").put(msg));
      }
    };
    socket.current.on("getMessagesByIds", handler);
    return () => socket.current.off("getMessagesByIds", handler);
  }, [chatID.id, db, setMessages]);

  const pinnedPreview = (message) => {
    if (!message) return "Pinned message";
    if (message.content) return message.content;
    if (message.location) return "📍 Location";
    const a = message.attachments && message.attachments[0];
    if (a) {
      if ((a.contentType || "").startsWith("image/")) return "📷 Photo";
      if ((a.contentType || "").startsWith("video/")) return "🎥 Video";
      if ((a.contentType || "").startsWith("audio/")) return "🎤 Voice message";
      return `📎 ${a.name || "File"}`;
    }
    return "Pinned message";
  };

  const dayLabel = (date) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((startOfToday - startOfDay) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  let pre = null;
  let prevDay = null;
  const rows = [];
  if (m) {
    Object.values(m).forEach((message) => {
      const date = new Date(message.createdAt);
      const day = date.toDateString();
      if (day !== prevDay) {
        prevDay = day;
        pre = null;
        rows.push(
          <div key={`day-${day}`} className="flex justify-center my-2 sticky top-0 z-10">
            <span className="bg-white/80 backdrop-blur-sm text-gray-500 text-xs font-medium px-3 py-1 rounded-full shadow-sm">
              {dayLabel(date)}
            </span>
          </div>
        );
      }
      rows.push(
        <Message
          key={message.clientId || message._id}
          item={message}
          setDialog={props.setDialog}
          setReply={setReply}
          setEdit={setEdit}
          setForward={setForward}
          infoPanel={props.infoPanel}
          reply_to={message.reply_to}
          reply_data={messagesById[message.reply_to]}
          pre={pre}
          selectionMode={selectionMode}
          selected={selectedIds.has(message._id)}
          onEnterSelection={enterSelection}
          onToggleSelect={toggleSelect}
          highlighted={highlightedMessageId === message._id}
          jumpToMessage={jumpToMatch}
          replyCount={replyCounts[message._id] || 0}
          onOpenThread={() => setThreadRoot(message)}
        />
      );
      pre = message.uid;
    });
  }
  // console.log("ff",messageCache,chatID.id)
  return (
    <div
      style={{ backgroundImage: wallpaper || `url(${background})`, backgroundRepeat: true }}
      className="w-full shadow-lg p-0 rounded-xl flex flex-1 h-full overflow-hidden flex-col items-center"
    >
      {chatID.id && (
        <TitleBar
          setDialog={props.setDialog}
          wallpaper={wallpaper}
          setWallpaper={(css) => {
            setWallpaperFor(chatID.id, css);
            setWallpaper(css);
          }}
          selectionMode={selectionMode}
          selectedCount={selectedIds.size}
          onCancelSelection={cancelSelection}
          onForwardSelected={forwardSelected}
          onDeleteSelected={deleteSelected}
          onCopySelected={copySelected}
          canCopySelected={selectedMessages.length === 1 && !!selectedMessages[0].content}
          chatSearchOpen={chatSearchOpen}
          onToggleChatSearch={toggleChatSearch}
          chatSearchQuery={chatSearchQuery}
          onChatSearchChange={runChatSearch}
          chatSearchResults={chatSearchResults}
          chatSearchIndex={chatSearchIndex}
          onChatSearchNext={() => goToSearchIndex(chatSearchIndex + 1)}
          onChatSearchPrev={() => goToSearchIndex(chatSearchIndex - 1)}
        />
      )}
      {chatID.id && activePinned && (
        <div className="w-full px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs">
          <img src={pinIcon} alt="" className="w-3.5 h-3.5 opacity-60 dark:invert shrink-0" />
          {pinnedIds.length > 1 && (
            <button
              onClick={() => setPinIndex((activePinIndex - 1 + pinnedIds.length) % pinnedIds.length)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
            >‹</button>
          )}
          <div
            onClick={() => jumpToMatch(activePinned)}
            className="flex-1 min-w-0 cursor-pointer"
          >
            <div className="text-[var(--accent-dark)] dark:text-[var(--accent)] font-semibold truncate">
              {(profiles[activePinned.uid] && profiles[activePinned.uid].name) || "Pinned"}
              {pinnedIds.length > 1 && <span className="text-gray-400 font-normal"> · {activePinIndex + 1}/{pinnedIds.length}</span>}
            </div>
            <div className="truncate text-gray-600 dark:text-gray-300">{pinnedPreview(activePinned)}</div>
          </div>
          {pinnedIds.length > 1 && (
            <button
              onClick={() => setPinIndex((activePinIndex + 1) % pinnedIds.length)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
            >›</button>
          )}
          {canPin && (
            <button
              onClick={() => unpinMessage(activePinned._id, chatID.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
            >✕</button>
          )}
        </div>
      )}
      {!chatID.id ? (
        <div className="flex-1 w-full flex flex-col items-center justify-center animate-fade-in">
          <div className="flex flex-col items-center gap-3 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg px-10 py-8">
            <img src={icon} alt="" className="h-24 w-auto" />
            <div className="text-purple-950/80 font-medium">Pick a conversation to get started</div>
            <div className="text-gray-400 text-sm max-w-64 text-center">Your chats live on the left — select one, or start a new group.</div>
          </div>
        </div>
      ) : messagesLoading ? (
        <div className="flex-1 w-full flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div
          ref={scrollable}
          onScroll={onScroll}
          className="mt-4  pb-4 pr-5 pl-5 flex flex-col w-full overflow-y-scroll overflow-visible  flex-1 bg-cover bg-repeat"
        >
          {rows}
        </div>
      )}
      {chatID.id && (
        <MessageBar
          setReply={setReply}
          reply={reply}
          edit={edit}
          setEdit={setEdit}
        />
      )}
      {forward && <ForwardDialog items={forward} onClose={() => setForward()} />}
      {threadRoot && (
        <ThreadPanel
          root={messagesById[threadRoot._id] || threadRoot}
          onClose={() => setThreadRoot(null)}
          messageProps={threadMessageProps}
        />
      )}
    </div>
  );
}
