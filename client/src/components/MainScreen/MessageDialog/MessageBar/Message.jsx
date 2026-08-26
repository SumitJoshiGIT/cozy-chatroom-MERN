import React from "react";
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useCtx } from "../../AppScreen";
import { apiOrigin } from "../../../../apiOrigin";
import Avatar from "../../../ui/Avatar";
import forward from "/forward.svg";
import reportIcon from "/report.svg";
import reply from "/reply.svg";
import copy from "/copy.svg";
import del from "/delete.svg";
import edit from "/edit.svg";
import reactIcon from "/react.svg";
import pinIcon from "/pin.svg";
import { downloadFile } from "../../../../download";
import { useToast } from "../../../ui/Toast";
import Spinner from "../../../ui/Spinner";
import VoiceNote from "./VoiceNote";
// Leaflet (pulled in by LocationMessage) is ~150kB gzipped on its own and
// only ever needed for the rare message that actually shares a location -
// split it into its own chunk instead of shipping it in everyone's initial
// bundle.
const LocationMessage = lazy(() => import("./LocationMessage"));
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
  const { profiles, requestProfile, db, userID, Messages, setMessages, chatID, socket, starred, toggleStar, chatdata, pinMessage, unpinMessage, reactMessage, report } = useCtx();
  const contextref = useRef();
  const [showReactions, setShowReactions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const longPressTimer = useRef(null);
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

  const sendToServer = useCallback(() => {
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
  }, [chatID.type, messageItem]);

  // Base64-encoded attachments over the socket take a lot longer than a
  // plain text send on a slow connection, so give them more room before
  // giving up and surfacing a retry affordance.
  const failTimeoutMs = messageItem.attachments && messageItem.attachments.length > 0 ? 45000 : 15000;

  const markFailed = useCallback(() => {
    setMessages((prev) => {
      const chatStore = prev[messageItem.chat];
      // Only flip to "failed" if this is still the same pending row - it may
      // have already been replaced by the real ack (success), or already
      // retried, between the timer being armed and now.
      if (!chatStore || !chatStore[messageItem.mid] || chatStore[messageItem.mid].status !== "⧖") return prev;
      const updated = { ...chatStore[messageItem.mid], status: "!" };
      if (db) db.transaction("messages", "readwrite").objectStore("messages").put(updated);
      return { ...prev, [messageItem.chat]: { ...chatStore, [messageItem.mid]: updated } };
    });
  }, [messageItem.chat, messageItem.mid, setMessages, db]);

  const retryHandle = useCallback(() => {
    setMessages((prev) => {
      const chatStore = prev[messageItem.chat];
      if (!chatStore || !chatStore[messageItem.mid]) return prev;
      const updated = { ...chatStore[messageItem.mid], status: "⧖" };
      if (db) db.transaction("messages", "readwrite").objectStore("messages").put(updated);
      return { ...prev, [messageItem.chat]: { ...chatStore, [messageItem.mid]: updated } };
    });
    sendToServer();
    setTimeout(markFailed, failTimeoutMs);
  }, [messageItem.chat, messageItem.mid, setMessages, db, sendToServer, markFailed, failTimeoutMs]);

  useEffect(() => {
    if (messageItem.status !== "⧖") return;
    sendToServer();
    const timer = setTimeout(markFailed, failTimeoutMs);
    return () => clearTimeout(timer);
    // Mount-only, matching the original one-shot-send behavior - retries are
    // driven explicitly via retryHandle, not by this effect re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    requestProfile(messageItem.uid);
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

  // Touch/mouse equivalent of the right-click menu - WhatsApp's "hold a
  // message to select" pattern. Starts selection mode on the held message,
  // or (once already in selection mode) toggles it, same as tapping the
  // checkbox.
  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      if (props.selectionMode) props.onToggleSelect(messageItem._id);
      else props.onEnterSelection(messageItem._id);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
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
    props.setForward([messageItem]);
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
  const pinLimitReached = !isPinned && (chat.pinned || []).length >= 6;
  const pinHandle = () => {
    if (pinLimitReached) {
      toast.error("You can only pin up to 6 messages — unpin one first");
      return;
    }
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
      className={`group w-full flex ${grouped ? "mt-0.5" : "mt-2.5"} justify-${flag ? "end" : "start"} animate-fade-in-up`}
    >
      <div className="mr-2 w-7 h-full flex items-start shrink-0">
        {props.selectionMode ? (
          <button
            type="button"
            onClick={() => props.onToggleSelect(messageItem._id)}
            aria-label={props.selected ? "Deselect message" : "Select message"}
            className={`w-5 h-5 mt-1 rounded-full border-2 flex items-center justify-center transition-colors ${
              props.selected ? "bg-[var(--accent)] border-[var(--accent)]" : "border-gray-300 dark:border-gray-500 bg-white/60 dark:bg-white/10"
            }`}
          >
            {props.selected && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ) : (
          !grouped && !flag && (
            <button
              onClick={onClick}
              className="rounded-full h-fit"
            >
              <Avatar src={profile.img && profile.img.src} size="xs" />
            </button>
          )
        )}
      </div>

      <div
        onContextMenu={handleRight}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        className="relative flex items-center gap-1 max-w-[75%] md:max-w-[60%]"
      >
        <div className="relative min-w-0">
        {props.selectionMode && (
          <div
            onClick={() => props.onToggleSelect(messageItem._id)}
            className="absolute inset-0 z-20 cursor-pointer rounded-[1.15rem]"
          />
        )}
        {deleting && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/30 rounded-2xl z-10">
            <Spinner size="sm" />
          </div>
        )}
        <div
          className={`px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] relative border
            ${flag
              ? "bg-[var(--accent-light)] dark:bg-[#3a2a52] text-gray-800 dark:text-gray-100 border-[var(--accent)]/15 dark:border-white/5"
              : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border-black/5 dark:border-white/5"}
            ${flag
              ? `rounded-[1.15rem] ${grouped ? "rounded-tr-[1.15rem]" : "rounded-tr-md"}`
              : `rounded-[1.15rem] ${grouped ? "rounded-tl-[1.15rem]" : "rounded-tl-md"}`}
            ${props.selected ? "ring-2 ring-[var(--accent)]" : ""}
            ${props.highlighted ? "ring-2 ring-amber-400 transition-shadow duration-300" : ""}
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
                <Suspense fallback={<div className="w-56 h-36 rounded-2xl bg-black/5 dark:bg-white/10 animate-pulse" />}>
                  <LocationMessage
                    location={messageItem.location}
                    flag={flag}
                    onStop={() => socket.current.emit("stopLiveLocation", { id: messageItem._id })}
                  />
                </Suspense>
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
                  {isPinned && <img src={pinIcon} title="Pinned" alt="Pinned" className="w-2.5 h-2.5 opacity-60 dark:invert" />}
                  {isStarred && <span className="text-amber-500">★</span>}
                  {messageItem.edited && <span className="italic">edited</span>}
                  {pad(time.getHours())}:{pad(time.getMinutes())}
                  {flag && (messageItem.status === "⧖" ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); markFailed(); }}
                      title="Sending… · Tap to cancel"
                      className="align-middle"
                    >
                      <Spinner size="xs" />
                    </button>
                  ) : messageItem.status === "!" ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); retryHandle(); }}
                      title="Failed to send · Tap to retry"
                      className="w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center text-[0.55rem] font-bold leading-none shrink-0"
                    >!</button>
                  ) : (
                    <span className={messageItem.status === "✔✔" ? "text-[var(--accent-dark)]" : ""}>{messageItem.status}</span>
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
            onClick={starHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span className={`w-4 h-4 flex items-center justify-center ${isStarred ? "text-amber-500" : "text-gray-500"}`}>★</span>
            <div>{isStarred ? "Unstar" : "Star"}</div>
          </button>

          {canPin && (
            <button
              onClick={pinHandle}
              disabled={pinLimitReached}
              title={pinLimitReached ? "Pin limit reached (6) - unpin one first" : undefined}
              className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <img src={pinIcon} className={`w-4 h-4 dark:invert ${isPinned ? "" : "opacity-60 dark:opacity-80"}`} alt="" />
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

        {/* WhatsApp-style hover affordance - lives on the message itself
            instead of being buried in the right-click menu. Only visible on
            hover/focus so it doesn't clutter every row at rest. */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowReactions((v) => !v); }}
          title="React"
          aria-label="React to message"
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm border border-black/5 dark:border-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <img src={reactIcon} className="w-3.5 h-3.5 opacity-70 dark:invert" alt="" />
        </button>
      </div>
    </div>
  );
}
