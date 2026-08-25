import React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useCtx } from "../../AppScreen";
import { apiOrigin } from "../../../../apiOrigin";
import Avatar from "../../../ui/Avatar";
import forward from "/forward.svg";
import reportIcon from "/report.svg";
import reply from "/reply.svg";
import copy from "/copy.svg";
import del from "/delete.svg";
import edit from "/edit.svg";
import { downloadFile } from "../../../../download";
import { useToast } from "../../../ui/Toast";
import Spinner from "../../../ui/Spinner";
import VoiceNote from "./VoiceNote";
import LocationMessage from "./LocationMessage";
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const formatSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const FILE_BADGES = {
  "application/pdf": { label: "PDF", className: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300" },
  "application/msword": { label: "DOC", className: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { label: "DOC", className: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300" },
  "application/vnd.ms-excel": { label: "XLS", className: "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { label: "XLS", className: "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300" },
  "application/vnd.ms-powerpoint": { label: "PPT", className: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { label: "PPT", className: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300" },
  "text/plain": { label: "TXT", className: "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-200" },
  "text/csv": { label: "CSV", className: "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300" },
  "application/zip": { label: "ZIP", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
};
const fileBadge = (contentType, name) =>
  FILE_BADGES[contentType] || {
    label: (name || "").split(".").pop()?.slice(0, 3).toUpperCase() || "FILE",
    className: "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-200",
  };

export default function (props) {
  const { profiles, db, userID, Messages, chatID, socket, starred, toggleStar, chatdata, pinMessage, unpinMessage, reactMessage, report } = useCtx();
  const contextref = useRef();
  const [showReactions, setShowReactions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const messageItem = props.item;
  if (!messageItem.status) {
    messageItem.status = "✔";
    if (db)
      db.transaction("messages", "readwrite")
        .objectStore("messages")
        .put(messageItem);
  }
  const profile = profiles[messageItem.uid] || {};
  // createdAt, not updatedAt - markSeen/reactions/edits bump updatedAt, which
  // used to make a message's displayed send-time jump to "now" whenever its
  // status flipped to read.
  const time = new Date(messageItem.createdAt);
  const flag = messageItem.uid == userID.current;
  const repliedMessage = props.reply_to
    ? props.reply_data || messageItem.replyToMessage
    : null;
  const repliedProfile = repliedMessage ? profiles[repliedMessage.uid] || {} : {};

  useEffect(() => {
    if (messageItem.status == "⧖") {
      console.log(
        "pending",
        chatID.type == "user" ? "createChatPrivate" : "sendMessage",
        chatID.type == "user" ? "createChatPrivate" : "sendMessage",
        messageItem
      );
      socket.current.emit(
        chatID.type == "user" ? "createChatPrivate" : "sendMessage",
        {
          cid: messageItem.chat,
          content: messageItem.content,
          replace: messageItem._id,
          reply_to: messageItem.reply_to,
          attachments: messageItem.attachments,
        }
      );
    }
  }, []);
  useEffect(() => {
    //        messageCache
  }, []);

  useEffect(() => {
    if (!profiles[messageItem.uid]) {
      socket.current.emit("getProfile", { uid: messageItem.uid });
    }
  }, [profiles[messageItem.uid]]);

  const handleRight = (event) => {
    event.preventDefault();
    let flag=0
    if (contextref.current) {
      contextref.current.style.display = "block";
      document.addEventListener('click',function click(){
        contextref.current.style.display='none';
        document.removeEventListener('click',click);
      })
      
      document.addEventListener('contextmenu',function rclick(event){
        if(contextref.current.contains(event.target))contextref.current.style.display='none';
        document.removeEventListener('contextmenu',rclick);
      }) 
    }
    flag=1;
    event.preventDefault();
  };
  const onClick = useCallback(() => {
    props.infoPanel.current = messageItem.uid;
    props.setDialog(2);
  }, [profile]);

  const replyHandle = () => {
    props.setReply([messageItem, profile]);
  };
  const copyHandle = () => {
    navigator.clipboard.writeText(messageItem.content);
  };
  const forwardHandle = () => {
    props.setForward([messageItem, profile]);
  };
  const reportHandle = () => {
    report(messageItem._id, "message");
  };
  const editHandle = () => {
    props.setEdit([messageItem]);
  };
  const isStarred = starred && starred.has(messageItem._id);
  const starHandle = () => {
    toggleStar(messageItem._id);
  };
  const chat = chatdata[chatID.id] || {};
  const canPin = chat.type !== 'group' || (chat.admins||[]).includes(userID.current) || chat.owner===userID.current;
  const isPinned = (chat.pinned||[]).includes(messageItem._id);
  const pinHandle = () => {
    (isPinned ? unpinMessage : pinMessage)(messageItem._id, chatID.id);
  };
  const reactHandle = (emoji) => {
    reactMessage(messageItem._id, chatID.id, emoji);
    setShowReactions(false);
  };
  const myReaction = (messageItem.reactions||[]).find(r => (r.users||[]).includes(userID.current));
  const deleteHandle = () => {
    setDeleting(true);
    socket.current.emit("deleteMessage", [
      messageItem.mid,
      messageItem._id,
      messageItem.chat,
    ]);
  };

  const grouped = props.pre == messageItem.uid;
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    <div
      id={messageItem._id}
      className={`w-full flex ${grouped ? "mt-0.5" : "mt-2.5"} justify-${flag ? "end" : "start"} animate-fade-in-up`}
    >
      <div className="mr-2 w-7 h-full flex shrink-0">
        {!grouped && !flag && (
          <button
            onClick={onClick}
            className="rounded-full h-fit"
          >
            <Avatar src={profile.img && profile.img.src} size="xs" />
          </button>
        )}
      </div>

      <div onContextMenu={handleRight} className="relative max-w-[75%] md:max-w-[60%]">
        {deleting && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/30 rounded-2xl z-10">
            <Spinner size="sm" />
          </div>
        )}
        <div
          className={`px-2.5 py-1.5 shadow-sm relative
            ${flag ? "bg-[#DCF8C6] dark:bg-[#245a4b] dark:text-gray-100" : "bg-white dark:bg-gray-700 dark:text-gray-100"}
            ${flag
              ? `rounded-2xl ${grouped ? "rounded-tr-2xl" : "rounded-tr-md"}`
              : `rounded-2xl ${grouped ? "rounded-tl-2xl" : "rounded-tl-md"}`}
          `}
        >
          <div>
            {!grouped && !flag && (
              <div
                style={{ color: profile.color }}
                className="text-xs font-bold mb-0.5"
              >
                {profile.name}
              </div>
            )}

            {repliedMessage ? (
              <div
                onClick={() => {
                  const element = document.getElementById(props.reply_to);
                  if (element) element.scrollIntoView({ block: "center" });
                }}
                className="cursor-pointer flex flex-col overflow-clip rounded-md pl-2 py-1 mb-1 bg-black/5 border-l-2 text-xs"
                style={{ borderColor: repliedProfile.color || '#a78bfa' }}
              >
                <p style={{ color: repliedProfile.color }} className="truncate font-bold">{repliedProfile.name || "Unknown"}</p>
                <span className="truncate text-gray-500">
                  {repliedMessage.content}
                </span>
              </div>
            ) : null}

            {messageItem.location && (
              <div className="mb-1">
                <LocationMessage
                  location={messageItem.location}
                  flag={flag}
                  onStop={() => socket.current.emit("stopLiveLocation", { id: messageItem._id })}
                />
              </div>
            )}

            {messageItem.attachments && messageItem.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {messageItem.attachments.map((a, idx) =>
                  (a.contentType || "").startsWith("image/") ? (
                    <a key={idx} href={`${apiOrigin}/${a.src}`} target="_blank" rel="noreferrer">
                      <img src={`${apiOrigin}/${a.src}`} alt={a.name} className="max-h-40 max-w-52 rounded-2xl object-cover" />
                    </a>
                  ) : (a.contentType || "").startsWith("video/") ? (
                    <video key={idx} src={`${apiOrigin}/${a.src}`} controls className="max-h-40 max-w-52 rounded-2xl" />
                  ) : (a.contentType || "").startsWith("audio/") ? (
                    <VoiceNote key={idx} src={`${apiOrigin}/${a.src}`} />
                  ) : (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        downloadFile(`${apiOrigin}/${a.src}`, a.name).catch(() => toast.error("Couldn't download file"))
                      }
                      className="flex items-center gap-2.5 w-52 px-2.5 py-2 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors text-left"
                    >
                      {(() => {
                        const badge = fileBadge(a.contentType, a.name);
                        return (
                          <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-[0.6rem] font-bold tracking-tight ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{a.name}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{formatSize(a.size)}</span>
                      </span>
                    </button>
                  )
                )}
              </div>
            )}

            {(() => {
              const footer = (
                <span className="shrink-0 flex items-center gap-0.5 text-[0.65rem] text-gray-400 ml-auto -mb-0.5">
                  {isPinned && <span title="Pinned">📌</span>}
                  {isStarred && <span className="text-amber-500">★</span>}
                  {messageItem.edited && <span className="italic">edited</span>}
                  {pad(time.getHours())}:{pad(time.getMinutes())}
                  {flag && (messageItem.status === "⧖" ? (
                    <Spinner size="xs" className="align-middle" />
                  ) : (
                    <span className={messageItem.status === "✔✔" ? "text-purple-500" : ""}>{messageItem.status}</span>
                  ))}
                </span>
              );
              if (messageItem.content) {
                return (
                  <div className="flex items-end gap-2 flex-wrap">
                    <span className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words flex-1 min-w-0">
                      {messageItem.content}
                    </span>
                    {footer}
                  </div>
                );
              }
              if ((messageItem.attachments && messageItem.attachments.length > 0) || messageItem.location) {
                return <div className="flex justify-end">{footer}</div>;
              }
              return null;
            })()}

            {messageItem.reactions && messageItem.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {messageItem.reactions.map((r) => (
                  <button
                    key={r.emoji}
                    onClick={() => reactHandle(r.emoji)}
                    className={`text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                      (r.users||[]).includes(userID.current)
                        ? "bg-[var(--accent-light)] border-[var(--accent)]"
                        : "bg-black/5 dark:bg-white/10 border-transparent"
                    }`}
                  >
                    <span>{r.emoji}</span>
                    <span className="text-gray-500 dark:text-gray-300">{r.users.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {showReactions && (
          <div
            onMouseLeave={() => setShowReactions(false)}
            className="absolute z-30 flex gap-1 bg-white dark:bg-gray-800 shadow-lg rounded-full px-2 py-1 -top-10 left-0"
          >
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => reactHandle(e)}
                className={`text-lg hover:scale-125 transition-transform ${myReaction && myReaction.emoji === e ? "scale-125" : ""}`}
              >{e}</button>
            ))}
          </div>
        )}
        <div
          onClick={() => {
            contextref.current.style.display = "none";
          }}
          ref={contextref}
          onMouseLeave={() => {
            contextref.current.style.display = "none";
          }}
          className="font-semibold text-gray-600 dark:text-gray-200 absolute text-sm w-40 py-2 h-fit hidden bg-white dark:bg-gray-800 shadow-lg rounded-lg z-20"
        >
          <button
            onClick={replyHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img src={reply} className="w-4 h-4 dark:invert dark:opacity-80"></img>
            <div>Reply</div>
          </button>
          <button
            onClick={copyHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img src={copy} className="w-4 h-4 dark:invert dark:opacity-80"></img>
            <div>Copy Text</div>
          </button>
          <button
            onClick={forwardHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img src={forward} className="w-4 h-4 dark:invert dark:opacity-80"></img>
            <div>Forward</div>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); contextref.current.style.display = "none"; setShowReactions((v) => !v); }}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span className="w-4 h-4 flex items-center justify-center">😊</span>
            <div>React</div>
          </button>

          <button
            onClick={starHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span className={`w-4 h-4 flex items-center justify-center ${isStarred ? "text-amber-500" : "text-gray-500"}`}>★</span>
            <div>{isStarred ? "Unstar" : "Star"}</div>
          </button>

          {canPin && (
            <button
              onClick={pinHandle}
              className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className={`w-4 h-4 flex items-center justify-center ${isPinned ? "" : "opacity-60"}`}>📌</span>
              <div>{isPinned ? "Unpin" : "Pin"}</div>
            </button>
          )}

          {flag && messageItem.content && (
            <button
              onClick={editHandle}
              className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <img src={edit} className="w-4 h-4 dark:invert dark:opacity-80"></img>
              <div>Edit</div>
            </button>
          )}

          <button
            onClick={deleteHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img src={del} className="w-4 h-4 dark:invert dark:opacity-80"></img>
            <div>Delete</div>
          </button>

          <button
            onClick={reportHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img src={reportIcon} className="w-4 h-4 dark:invert dark:opacity-80"></img>
            <div>Report</div>
          </button>
        </div>
      </div>
    </div>
  );
}
