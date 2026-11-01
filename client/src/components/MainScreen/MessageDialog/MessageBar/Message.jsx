import React, { Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { useCtx } from "../../AppScreen";
import { attachmentUrl } from "../../../../attachmentUrl";
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
import DocumentPreview from "./DocumentPreview";
import MediaViewer from "./MediaViewer";
import ConfirmDialog, { shouldConfirm } from "../../../ui/ConfirmDialog";
// Leaflet is heavy and only needed once a location message is on screen.
const LocationMessage = lazy(() => import("./LocationMessage"));
// Profile colours are random, so pull them toward the text colour to stay
// legible on both themes.
const readableColor = (color) => (color ? `color-mix(in srgb, ${color} 55%, var(--text))` : undefined);
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EDIT_WINDOW_MS = 15 * 60 * 1000;
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
  const { profiles, db, userID, chatID, socket, starred, toggleStar, chatdata, pinMessage, unpinMessage, reactMessage, report, requestProfile, mediaToken } = useCtx();
  const [viewer, setViewer] = useState(null);
  const contextref = useRef();
  const [showReactions, setShowReactions] = useState(false);
  const [contextOpen, setContextOpen] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
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
  const time = new Date(
    messageItem.createdAt || messageItem.time || messageItem.updatedAt
  );
  const flag = messageItem.uid == userID.current;
  const repliedMessage = props.reply_to
    ? props.reply_data || messageItem.replyToMessage
    : null;
  const repliedProfile = repliedMessage ? profiles[repliedMessage.uid] || {} : {};

  useEffect(() => {
    if (messageItem.status == "⧖" && !messageItem.sendQueued) {
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
    if (!profiles[messageItem.uid]) requestProfile(messageItem.uid);
  }, [profiles[messageItem.uid]]);

  useEffect(() => {
    if (!deleting) return;
    const reset = ({ event }) => { if (event === "deleteMessage") setDeleting(false); };
    const socketRef = socket.current;
    socketRef.on("messageError", reset);
    return () => socketRef.off("messageError", reset);
  }, [deleting]);

  useEffect(() => {
    const closeOtherMenus = (event) => {
      if (event.detail !== messageItem._id) {
        setContextOpen(null);
        setShowReactions(false);
      }
    };
    const closeOnOutsideClick = (event) => {
      if (contextref.current && !contextref.current.contains(event.target)) {
        setContextOpen(null);
      }
    };
    window.addEventListener("lavender:close-message-menus", closeOtherMenus);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      window.removeEventListener("lavender:close-message-menus", closeOtherMenus);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [messageItem._id]);

  const closeMenu = () => setContextOpen(null);

  const handleRight = (event) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent("lavender:close-message-menus", { detail: messageItem._id }));
    // Portaled and clamped: a menu inside the list would be painted under
    // later rows, and opening it near the edge would scroll the whole page.
    const MENU_WIDTH = 176;
    const MENU_HEIGHT = 340;
    setContextOpen({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - MENU_WIDTH - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - MENU_HEIGHT - 8)),
    });
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
    const proceed = (reason) => {
      report(messageItem._id, "message", reason);
      setConfirmation(null);
    };
    if (shouldConfirm("report-message")) {
      setConfirmation({
        action: "report-message",
        title: "Report this message?",
        message: "Tell us what is concerning about this message.",
        reasonPrompt: "Reason for reporting (optional)",
        onConfirm: proceed,
      });
    } else proceed();
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
    closeMenu();
  };
  const myReaction = (messageItem.reactions||[]).find(r => (r.users||[]).includes(userID.current));
  const canEdit = flag && messageItem.content && Date.now() - time.getTime() <= EDIT_WINDOW_MS;
  const isChatAdmin = chat.type === 'group' && ((chat.admins||[]).includes(userID.current) || chat.owner === userID.current);
  const canDelete = flag || isChatAdmin;
  const longPressTimer = useRef(null);
  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => props.onEnterSelection(messageItem._id), 450);
  };
  const cancelLongPress = () => clearTimeout(longPressTimer.current);
  const deleteHandle = () => {
    const proceed = () => {
      setDeleting(true);
      socket.current.emit("deleteMessage", [
        messageItem.mid,
        messageItem._id,
        messageItem.chat,
      ]);
      setConfirmation(null);
    };
    if (shouldConfirm("delete-message")) {
      setConfirmation({
        action: "delete-message",
        title: "Delete this message?",
        message: "This removes the message from this conversation.",
        confirmLabel: "Delete",
        danger: true,
        onConfirm: proceed,
      });
    } else proceed();
  };

  const grouped = props.pre == messageItem.uid;
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    <div
      id={messageItem._id}
      onClick={props.selectionMode ? () => props.onToggleSelect(messageItem._id) : undefined}
      onPointerDown={props.selectionMode ? undefined : (event) => { if (event.pointerType === "touch") startLongPress(); }}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerMove={cancelLongPress}
      className={`message-row w-full flex ${grouped ? "mt-0.5" : "mt-2.5"} ${flag ? "justify-end" : "justify-start"} ${flag ? "message-row-out" : "message-row-in"} ${props.selectionMode ? "is-selecting" : ""} ${props.selected ? "is-selected" : ""} ${props.highlighted ? "is-highlighted" : ""}`}
    >
      {props.selectionMode && (
        <span className={`message-select-check ${props.selected ? "is-checked" : ""}`} aria-hidden="true" />
      )}
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

      <div onContextMenu={handleRight} className="relative group max-w-[75%] md:max-w-[60%]">
        {deleting && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/30 rounded-2xl z-10">
            <Spinner size="sm" />
          </div>
        )}
        <div
          className={`message-bubble ${flag ? "message-bubble-out" : "message-bubble-in"} ${messageItem.status === "!" ? "is-failed" : ""} ${messageItem.status === "⧖" ? "is-pending" : ""} px-2.5 py-1.5 relative
            ${flag
              ? `rounded-2xl ${grouped ? "rounded-tr-2xl" : "rounded-tr-md"}`
              : `rounded-2xl ${grouped ? "rounded-tl-2xl" : "rounded-tl-md"}`}
          `}
        >
          <div>
            {!grouped && !flag && (
              <div
                style={{ color: readableColor(profile.color) }}
                className="text-xs font-bold mb-0.5"
              >
                {profile.name}
              </div>
            )}

            {repliedMessage ? (
              <div
                onClick={() => props.jumpToMessage(repliedMessage)}
                className="cursor-pointer flex flex-col overflow-clip rounded-md pl-2 py-1 mb-1 bg-black/5 border-l-2 text-xs"
                style={{ borderColor: repliedProfile.color || '#a78bfa' }}
              >
                <p style={{ color: readableColor(repliedProfile.color) }} className="truncate font-bold">{repliedProfile.name || "Unknown"}</p>
                <span className="truncate text-gray-500">
                  {repliedMessage.content}
                </span>
              </div>
            ) : null}

            {messageItem.location && (
              <div className="mb-1">
                <Suspense fallback={<div className="flex h-32 w-56 items-center justify-center"><Spinner size="sm" /></div>}>
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
                    <button key={idx} type="button" className="message-media" onClick={() => setViewer({ type: "image", src: attachmentUrl(a, mediaToken), name: a.name })}>
                      <img src={attachmentUrl(a, mediaToken)} alt={a.name} loading="lazy" className="max-h-40 max-w-52 rounded-2xl object-cover" />
                    </button>
                  ) : (a.contentType || "").startsWith("video/") ? (
                    <video key={idx} src={attachmentUrl(a, mediaToken)} controls className="max-h-40 max-w-52 rounded-2xl" />
                  ) : (a.contentType || "").startsWith("audio/") ? (
                    <VoiceNote key={idx} src={attachmentUrl(a, mediaToken)} />
                  ) : (
                    <div key={idx} className="w-64">
                      <DocumentPreview
                        src={attachmentUrl(a, mediaToken)}
                        name={a.name}
                        contentType={a.contentType}
                        size={formatSize(a.size)}
                        onDownload={() =>
                          downloadFile(attachmentUrl(a, mediaToken), a.name).catch(() => toast.error("Couldn't download file"))
                        }
                      />
                    </div>
                  )
                )}
              </div>
            )}

            {(() => {
              const footer = (
                <span className="message-meta shrink-0 flex items-center gap-0.5 text-[0.65rem] ml-auto -mb-0.5">
                  {isPinned && <span title="Pinned">📌</span>}
                  {isStarred && <span className="text-amber-500">★</span>}
                  {messageItem.edited && <span className="italic">edited</span>}
                  {pad(time.getHours())}:{pad(time.getMinutes())}
                  {flag && (messageItem.status === "⧖" ? (
                    <Spinner size="xs" className="align-middle" />
                  ) : (
                    messageItem.status === "!" ? (
                      <button
                        type="button"
                        title={messageItem.sendError || "Message failed. Retry"}
                        aria-label="Retry sending message"
                        onClick={() => socket.current.emit(
                          chatID.type === "user" ? "createChatPrivate" : "sendMessage",
                          {
                            cid: messageItem.chat,
                            content: messageItem.content,
                            replace: messageItem._id,
                            reply_to: messageItem.reply_to,
                            attachments: messageItem.attachments,
                          }
                        )}
                        className="message-retry font-bold underline decoration-dotted underline-offset-2"
                      >
                        Retry
                      </button>
                    ) : (
                      <span
                        role="img"
                        aria-label={messageItem.status === "✔✔" ? "Read" : "Sent"}
                        className={`message-ticks ${messageItem.status === "✔✔" ? "is-read" : ""}`}
                      />
                    )
                  ))}
                </span>
              );
              if (messageItem.content) {
                return (
                  <div className="flex items-end gap-2 flex-wrap">
                    <span className="message-text text-sm whitespace-pre-wrap break-words flex-1 min-w-0">
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
                    className={`message-reaction-chip text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
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
          {confirmation && <ConfirmDialog {...confirmation} onCancel={() => setConfirmation(null)} />}
        </div>
        {viewer && <MediaViewer item={viewer} onClose={() => setViewer(null)} />}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("lavender:close-message-menus", { detail: messageItem._id }));
            setShowReactions((value) => !value);
          }}
          aria-label="React to message"
          className={`message-reaction-trigger absolute z-10 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full items-center justify-center text-sm ${flag ? "-left-9" : "-right-9"} ${showReactions ? "is-open" : ""}`}
        >
          😊
        </button>
        {showReactions && (
          <div
            className={`message-reaction-picker absolute z-30 flex gap-1 bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10 shadow-lg rounded-full px-2 py-1 -top-11 ${flag ? "right-0" : "left-0"}`}
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
      </div>
      {contextOpen && createPortal(
        <div
          onClick={closeMenu}
          ref={contextref}
          style={{ left: contextOpen.x, top: contextOpen.y }}
          className="message-context-menu is-open font-semibold fixed text-sm w-44 py-1 h-fit z-50"
        >
          <button
            onClick={() => { replyHandle(); closeMenu(); }}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img src={reply} className="w-4 h-4 dark:invert dark:opacity-80"></img>
            <div>Reply</div>
          </button>
          <button
            onClick={() => { copyHandle(); closeMenu(); }}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img src={copy} className="w-4 h-4 dark:invert dark:opacity-80"></img>
            <div>Copy Text</div>
          </button>
          <button
            onClick={() => { forwardHandle(); closeMenu(); }}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img src={forward} className="w-4 h-4 dark:invert dark:opacity-80"></img>
            <div>Forward</div>
          </button>

          <button
            onClick={() => { starHandle(); closeMenu(); }}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span className={`w-4 h-4 flex items-center justify-center ${isStarred ? "text-amber-500" : "text-gray-500"}`}>★</span>
            <div>{isStarred ? "Unstar" : "Star"}</div>
          </button>

          {canPin && (
            <button
              onClick={() => { pinHandle(); closeMenu(); }}
              className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className={`w-4 h-4 flex items-center justify-center ${isPinned ? "" : "opacity-60"}`}>📌</span>
              <div>{isPinned ? "Unpin" : "Pin"}</div>
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => { editHandle(); closeMenu(); }}
              className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <img src={edit} className="w-4 h-4 dark:invert dark:opacity-80"></img>
              <div>Edit</div>
            </button>
          )}

          <button
            onClick={() => { props.onEnterSelection(messageItem._id); closeMenu(); }}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span className="w-4 h-4 flex items-center justify-center text-gray-500">✓</span>
            <div>Select</div>
          </button>

          {canDelete && (
            <button
              onClick={() => { deleteHandle(); closeMenu(); }}
              className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <img src={del} className="w-4 h-4 dark:invert dark:opacity-80"></img>
              <div>Delete</div>
            </button>
          )}

          <button
            onClick={() => { reportHandle(); closeMenu(); }}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img src={reportIcon} className="w-4 h-4 dark:invert dark:opacity-80"></img>
            <div>Report</div>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
