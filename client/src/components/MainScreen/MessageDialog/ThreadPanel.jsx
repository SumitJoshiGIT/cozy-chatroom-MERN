import { useState, useEffect, useMemo, useRef } from "react";
import { useCtx } from "../AppScreen";
import Message from "./MessageBar/Message";
import IconButton from "../../ui/IconButton";
import close from "/close.svg";
import send from "/send.svg";

// A thread is not a separate data model - it's every message whose reply_to
// points at `root`. This panel is purely an aggregated view over messages
// that are already flowing through the normal Messages[chatID.id] store
// (see the matching comment on the server's getThread handler), so a reply
// posted from here shows up both in this panel and inline in the main
// timeline, same as any other reply - threads here are additive, not a
// separate hidden channel.
export default function ThreadPanel({ root, onClose, messageProps }) {
  const { socket, chatID, Messages, userID } = useCtx();
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const m = Messages[chatID.id];

  useEffect(() => {
    socket.current.emit("getThread", { cid: chatID.id, rootId: root._id });
  }, [root._id, chatID.id]);

  const replies = useMemo(() => {
    if (!m) return [];
    return Object.values(m)
      .filter((msg) => msg.reply_to === root._id)
      .sort((a, b) => (a.mid > b.mid ? 1 : -1));
  }, [m, root._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [replies.length]);

  function sendReply(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socket.current.emit("sendMessage", { cid: chatID.id, content: text, reply_to: root._id });
    setText("");
  }

  let pre = null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-96 h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-3 border-b dark:border-gray-700 shrink-0">
          <div className="font-semibold text-gray-800 dark:text-gray-100">Thread</div>
          <IconButton icon={close} alt="Close thread" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Message {...messageProps} item={root} pre={null} />
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400 shrink-0">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>
          {replies.map((r) => {
            const row = (
              <Message {...messageProps} key={r.clientId || r._id} item={r} pre={pre} />
            );
            pre = r.uid;
            return row;
          })}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={sendReply} className="p-2 border-t dark:border-gray-700 flex items-center gap-2 shrink-0">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply in thread…"
            className="flex-1 min-w-0 rounded-full px-3 py-2 text-sm bg-black/5 dark:bg-white/10 outline-none text-gray-700 dark:text-gray-100 placeholder-gray-400"
          />
          <IconButton icon={send} alt="Send reply" onClick={sendReply} disabled={!text.trim()} />
        </form>
      </div>
    </div>
  );
}
