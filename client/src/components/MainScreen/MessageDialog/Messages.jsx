import MessageBar from "./MessageBar/MessageBar";
import Message from "./MessageBar/Message";
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
export default function MessageDialog(props) {
  const { Messages, chatID, scrollable, socket } = useCtx();
  const [reply, setReply] = useState();

  const onScroll = useCallback(
    function () {
      if (scrollable.current && scrollable.current.scrollTop < 20) {
        // socket.current.emit('messages',{cid:chatID.id,mid:Messages[chatID.id][0]?Messages[0]._id:null})
      }
    },
    [Messages]
  );

  const m = Messages[chatID.id];

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
      const date = new Date(message.updatedAt);
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
          infoPanel={props.infoPanel}
          reply_to={message.reply_to}
          reply_data={m[message.reply_to]}
          pre={pre}
        />
      );
      pre = message.uid;
    });
  }
  // console.log("ff",messageCache,chatID.id)
  return (
    <div
      style={{ backgroundImage: `url(${background})`, backgroundRepeat: true }}
      className="w-full shadow-lg p-0 rounded-xl flex flex-1 h-full overflow-hidden flex-col items-center"
    >
      {chatID.id && <TitleBar setDialog={props.setDialog} />}
      {!chatID.id ? (
        <div className="flex-1 w-full flex flex-col items-center justify-center animate-fade-in">
          <div className="flex flex-col items-center gap-3 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg px-10 py-8">
            <img src={icon} alt="" className="h-24 w-auto" />
            <div className="text-purple-950/80 font-medium">Pick a conversation to get started</div>
            <div className="text-gray-400 text-sm max-w-64 text-center">Your chats live on the left — select one, or start a new group.</div>
          </div>
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
      {chatID.id && <MessageBar setReply={setReply} reply={reply} />}
    </div>
  );
}
