import { useState, useMemo } from "react";
import { useCtx } from "../AppScreen";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Avatar from "../../ui/Avatar";
import close from "/close.svg";

export default function ForwardDialog({ items, onClose }) {
  const { chatdata, socket, userID } = useCtx();
  const [selected, setSelected] = useState(null);
  const [sent, setSent] = useState(false);
  const messages = items.filter((m) => m && m.content);

  const chats = useMemo(
    () => Object.values(chatdata || {}).filter((c) => c && c._id),
    [chatdata]
  );

  const forward = () => {
    if (!selected || messages.length === 0) return;
    messages.forEach((message) => {
      socket.current.emit("sendMessage", {
        cid: selected,
        content: message.content,
      });
    });
    setSent(true);
    setTimeout(onClose, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 animate-fade-in">
      <Card className="w-80 max-h-[70vh] flex flex-col p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800">Forward message</div>
          <button onClick={onClose}>
            <img src={close} className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-gray-400 mb-2 truncate">
          {messages.length === 1 ? `"${messages[0].content}"` : `${messages.length} messages selected`}
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {chats.map((c) => (
            <button
              key={c._id}
              onClick={() => setSelected(c._id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 ${selected === c._id ? "bg-[var(--accent-light)]" : ""}`}
            >
              <Avatar src={c.img && c.img.src} kind={c.type === "group" ? "group" : "user"} size="xs" />
              <div className="text-sm text-gray-700 truncate">{c.name || "Unnamed"}</div>
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          className="mt-3 w-full"
          disabled={!selected || sent || messages.length === 0}
          onClick={forward}
        >
          {sent ? "Sent" : "Forward"}
        </Button>
      </Card>
    </div>
  );
}
