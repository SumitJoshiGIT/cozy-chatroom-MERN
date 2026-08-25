import MessageBar from "./MessageBar/MessageBar";
import Message from "./MessageBar/Message";
import ForwardDialog from "./ForwardDialog";
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
import { getWallpaper, setWallpaperFor } from "../../../wallpaper";
import Spinner from "../../ui/Spinner";
export default function MessageDialog(props) {
  const { Messages, chatID, scrollable, socket, chatdata, userID, unpinMessage, loadedChats } = useCtx();
  const [reply, setReply] = useState();
  const [edit, setEdit] = useState();
  const [forward, setForward] = useState();
  const [wallpaper, setWallpaper] = useState(() => getWallpaper(chatID.id));

  useEffect(() => {
    setWallpaper(getWallpaper(chatID.id));
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

  // Lazy load: only fetch a chat's history once it's actually opened, and
  // only if we don't already have it - a chat with unread messages already
  // got caught up eagerly via the sync-manifest handshake in AppScreen, so
  // this effect only fires for a chat that's genuinely never been loaded on
  // this device (first open, or a cleared local cache).
  useEffect(() => {
    if (!chatID.id || loadedChats.has(chatID.id)) return;
    socket.current.emit("messages", { cid: chatID.id, mode: "before", cursorMid: null });
  }, [chatID.id]);

  const messagesLoading = !!chatID.id && !loadedChats.has(chatID.id);
  const chat = chatdata[chatID.id] || {};
  const canPin = chat.type !== 'group' || (chat.admins||[]).includes(userID.current) || chat.owner===userID.current;

  const messagesById = useMemo(() => {
    const byId = {};
    if (m) Object.values(m).forEach((message) => { byId[message._id] = message; });
    return byId;
  }, [m]);

  const pinnedIds = chat.pinned || [];
  const latestPinned = pinnedIds.length ? messagesById[pinnedIds[pinnedIds.length - 1]] : null;

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
          key={message._id}
          item={message}
          setDialog={props.setDialog}
          setReply={setReply}
          setEdit={setEdit}
          setForward={setForward}
          infoPanel={props.infoPanel}
          reply_to={message.reply_to}
          reply_data={messagesById[message.reply_to]}
          pre={pre}
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
        />
      )}
      {chatID.id && latestPinned && (
        <div className="w-full px-4 py-1.5 bg-white/90 dark:bg-gray-800/90 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs">
          <span>📌</span>
          <div
            onClick={() => {
              const element = document.getElementById(latestPinned._id);
              if (element) element.scrollIntoView({ block: "center" });
            }}
            className="flex-1 min-w-0 truncate cursor-pointer text-gray-600 dark:text-gray-300"
          >
            {latestPinned.content || "Pinned message"}
            {pinnedIds.length > 1 && <span className="text-gray-400"> · +{pinnedIds.length - 1} more pinned</span>}
          </div>
          {canPin && (
            <button
              onClick={() => unpinMessage(latestPinned._id, chatID.id)}
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
      {forward && <ForwardDialog item={forward} onClose={() => setForward()} />}
    </div>
  );
}
