import { useEffect } from "react";
import { useCtx } from "../AppScreen";
import Card from "../../ui/Card";
import IconButton from "../../ui/IconButton";
import Avatar from "../../ui/Avatar";
import close from "/close.svg";

export default function StarredMessages(props) {
  const { starredMessages, getStarred, toggleStar, profiles, chatdata, setMessageDialog, setChatID } = useCtx();

  useEffect(() => {
    getStarred();
  }, []);

  const pad = (n) => n.toString().padStart(2, "0");

  return (
    <Card className="max-w-md w-full h-full flex flex-col overflow-hidden animate-fade-in-up">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line shrink-0">
        <IconButton icon={close} alt="Close" onClick={() => setMessageDialog(0)} />
        <div className="font-semibold text-lg text-ink ">Starred Messages</div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {(!starredMessages || starredMessages.length === 0) && (
          <div className="text-sm text-ink-muted text-center mt-10">
            No starred messages yet. Long-press or right-click a message and choose Star to save it here.
          </div>
        )}
        {(starredMessages || []).map((m) => {
          const profile = profiles[m.uid] || {};
          const chat = chatdata[m.chat] || {};
          const time = new Date(m.createdAt);
          return (
            <div key={m._id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent-soft ">
              <Avatar src={profile.img && profile.img.src} size="xs" />
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => {
                  setChatID({ id: m.chat, type: chat.type });
                  setMessageDialog(0);
                }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: profile.color }} className="text-xs font-bold">{profile.name || "Unknown"}</span>
                  <span className="text-[0.65rem] text-ink-muted">in {chat.name || "a chat"}</span>
                </div>
                <div className="text-sm text-ink truncate">{m.content}</div>
                <div className="text-[0.65rem] text-ink-muted">{pad(time.getHours())}:{pad(time.getMinutes())}</div>
              </div>
              <button
                onClick={() => toggleStar(m._id)}
                className="text-amber-500 text-lg shrink-0"
                title="Unstar"
              >★</button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
