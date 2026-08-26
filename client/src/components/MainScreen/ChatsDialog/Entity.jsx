import { useState, useEffect, useCallback } from "react";

import { useCtx } from "../AppScreen";
import Avatar from "../../ui/Avatar";

export default function (props) {
  const {
    chatID,
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
  } = useCtx();
  
  const [chatid, setId] = useState(props.id);
  let chat = chatdata[chatid];
  useEffect(()=>{
  if(chat.type=='private'){
    if(profiles[chat.sender]){
      const user=profiles[chat.sender];
      delete user._id;
      chat={...chat,...user}
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
      socket.current.on(`private.${chat._id}`, (newchat) => {
        newchat.sender = chat._id;
        props.cache.current.chats[newchat._id] = newchat;
        setChatdata((prev) => {
          const n = { ...prev };
          if (n) delete n[newchat.sender];
          n[newchat._id] = newchat;
          return n;
        });
        setId(newchat._id);
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
          {latest && (
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
