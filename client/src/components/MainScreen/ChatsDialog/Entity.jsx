import { useState, useEffect, useCallback, useRef } from "react";

import { useCtx } from "../AppScreen";
import Avatar from "../../ui/Avatar";

export default function (props) {
  const {
    chatID,
    chatIDRef,
    socket,db,
    profiles,
    requestProfile,
    chatdata,
    chatCache,
    setChatdata,
    scrollable,
    setChatID,
    privateChats,
    setMessageDialog,
    userID,
    drafts,
  } = useCtx();
  
  const [chatid, setId] = useState(props.id);
  let chat = chatdata[chatid];
  useEffect(()=>{
  if(chat.type=='private'){
    if(profiles[chat.sender]){
      // A "message yourself" chat's sender is your own id, so this would
      // otherwise merge (and, via the delete below, mutate) your own live
      // profiles[] entry - copy it and label the chat distinctly instead of
      // just showing your own name back at you.
      const isSelf = chat.sender === userID.current;
      const user = isSelf ? { ...profiles[chat.sender] } : profiles[chat.sender];
      delete user._id;
      chat={...chat,...user, ...(isSelf ? { name: "Saved Messages" } : {})}
      if(chatCache.current.chats[chat._id])
        chatCache.current.chats[chat._id]=chat;
     if(chatdata[chat._id])
      setChatdata((prev) => {
        return { ...prev, [chat._id]: chat };
      });
    }
    else requestProfile(chat.sender);
  }
},[profiles[chat.sender]])

  const onClick = (event) => {
    setMessageDialog(0);
    setChatID((prev) => {
      return { id: chat._id, type: chat.type };
    });
  };

  useEffect(()=>{
    if (chat.type == "user") {
      const pseudoId = chat._id;
      socket.current.on(`private.${pseudoId}`, (newchat) => {
        newchat.sender = pseudoId;
        props.cache.current.chats[newchat._id] = newchat;
        setChatdata((prev) => {
          const n = { ...prev };
          if (n) delete n[newchat.sender];
          n[newchat._id] = newchat;
          return n;
        });
        setId(newchat._id);
        // AppScreen.jsx's "messages" handler independently migrates the
        // pending message and the globally-open chatID from this same
        // pseudo id, triggered by a *different* server event ("messages",
        // not "private.<id>") fired later in the same createChatPrivate
        // call. Whichever of the two arrives first, deleting the pseudo-id
        // entry from chatdata above - while chatID still points at it,
        // if this contact is the one currently open - leaves
        // chatdata[chatID.id] resolving to nothing until the other handler
        // catches up. Updating chatID here too closes that window
        // regardless of arrival order (a harmless no-op re-set if the other
        // handler already did it first).
        if (chatIDRef.current.id === pseudoId) setChatID({ id: newchat._id, type: newchat.type });
      });
    }
  }, [chatid]);

  const active = chatID.id === chat._id;
  const pad = (n) => n.toString().padStart(2, "0");
  // Sourced from chat.lastMessage (denormalized server-side) rather than the
  // loaded message list - the sidebar needs to show a preview for chats
  // whose message history hasn't been fetched at all (messages now load
  // lazily, only once a chat is actually opened).
  const latest = chat.lastMessage;

  // Disappearing messages: the sidebar preview is denormalized onto the
  // chat doc, so it doesn't update on its own when the message it's showing
  // expires (nothing pushes that - Mongo's TTL sweep is passive). Each chat
  // row independently notices via its own expiresAt and asks the server to
  // recompute it - this runs regardless of whether the chat itself is
  // currently open, unlike Messages.jsx's per-message sweep.
  const refreshRequested = useRef(false);
  useEffect(() => {
    if (!latest || !latest.expiresAt) return;
    const check = () => {
      if (refreshRequested.current) return;
      if (new Date(latest.expiresAt).getTime() > Date.now()) return;
      refreshRequested.current = true;
      socket.current.emit("refreshLastMessage", { cid: chat._id });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [latest && latest._id, latest && latest.expiresAt]);

  // A fresh lastMessage (new send, or the very refresh this effect just
  // asked for) means the in-flight guard above no longer applies to it.
  useEffect(() => { refreshRequested.current = false; }, [latest && latest._id]);

  const attachmentPreviewLabel = (contentType, name) => {
    const type = contentType || "";
    if (type.startsWith("image/")) return "📷 Photo";
    if (type.startsWith("video/")) return "🎥 Video";
    if (type.startsWith("audio/")) return "🎤 Voice message";
    return `📎 ${name || "File"}`;
  };
  const previewText = latest
    ? (latest.content
        || (latest.attachmentType ? attachmentPreviewLabel(latest.attachmentType, latest.attachmentName) : "")
        || (latest.type === "location" ? (latest.liveLocation ? "📍 Live location" : "📍 Location") : ""))
    : "";
  const previewName = latest
    ? (latest.uid == userID.current ? "You" : (profiles[latest.uid] ? profiles[latest.uid].name : ""))
    : "";
  const draft = drafts[chat._id];

  return (
    <div
      onClick={onClick}
      title={props.style ? (chat.name || "Unnamed") : undefined}
      className={`flex items-center cursor-pointer transition-colors ${
        props.style
          ? 'justify-center w-12 h-12 shrink-0 mb-1 rounded-full'
          : 'gap-3 w-full px-2 py-2 mb-0.5 rounded-lg'
      } ${active ? 'bg-purple-100 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700/60'}`}
    >
      <Avatar
        src={chat.img && chat.img.src}
        kind={chat.type == "group" ? "group" : "user"}
        size={props.style ? 'sm' : 'md'}
        className={props.style && active ? 'ring-2 ring-purple-400' : ''}
      />

      {!props.style && (
        <div className="min-w-0 flex-1">
          <div className="flex justify-between items-baseline gap-2">
            <div className="truncate text-base font-semibold text-gray-800 dark:text-gray-100">
              {chat.name || "Unnamed"}
            </div>
            {latest && (
              <span className="text-xs text-gray-400 shrink-0">
                {pad(new Date(latest.createdAt).getHours())}:
                {pad(new Date(latest.createdAt).getMinutes())}
              </span>
            )}
          </div>
          {draft ? (
            <div className="truncate text-sm">
              <span className="text-red-500 dark:text-red-400">Draft: </span>
              <span className="text-gray-500 dark:text-gray-400">{draft}</span>
            </div>
          ) : latest && (
            <div className="truncate text-sm text-gray-500">
              {previewName && (
                <span
                  style={{
                    color: latest.uid == userID.current ? undefined : (profiles[latest.uid] ? profiles[latest.uid].color : undefined),
                  }}
                  className={latest.uid == userID.current ? "text-gray-400" : ""}
                >
                  {previewName}:{" "}
                </span>
              )}
              <span>{previewText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
