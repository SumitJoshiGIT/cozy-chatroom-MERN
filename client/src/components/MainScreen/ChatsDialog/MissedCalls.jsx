import { useEffect } from "react";
import { useCtx } from "../AppScreen";
import Avatar from "../../ui/Avatar";
import { startCall } from "../startCall";

const timeLabel = (value) => {
  const date = new Date(value);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function MissedCalls() {
  const { missedCalls, markMissedCallsSeen, chatdata, profiles, socket, setChatID, setMessageDialog } = useCtx();

  useEffect(() => { markMissedCallsSeen(); }, [missedCalls.length]);

  if (!missedCalls.length) {
    return (
      <div className="px-4 py-10 text-center animate-fade-in">
        <p className="text-sm font-semibold text-ink">No missed calls</p>
        <p className="mt-1 text-xs text-ink-muted">Calls you don't answer will appear here.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {missedCalls.map((call) => {
        const chat = chatdata[call.chat];
        if (!chat) return null;
        const isGroup = chat.type === "group";
        const caller = profiles[call.uid];
        const name = isGroup ? chat.name : caller?.name || chat.name || "Unknown";
        const kind = /voice/.test(call.content) ? "audio" : "video";
        return (
          <li key={call._id} className="missed-call flex items-center gap-3 rounded-lg px-2 py-2">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => {
                setMessageDialog(0);
                setChatID({ id: chat._id, type: chat.type });
              }}
            >
              <Avatar src={chat.img?.src} kind={isGroup ? "group" : "user"} />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{name}</span>
                <span className="block truncate text-xs text-danger">{call.content}</span>
              </span>
            </button>
            <span className="shrink-0 text-xs text-ink-muted">{timeLabel(call.createdAt)}</span>
            <button
              type="button"
              aria-label={`Call ${name} back`}
              className="missed-call-back"
              onClick={() => startCall(socket, chat, kind)}
            >
              ☎
            </button>
          </li>
        );
      })}
    </ul>
  );
}
