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
  let pre = null;
  // console.log("ff",messageCache,chatID.id)
  return (
    <div
      style={{ backgroundImage: `url(${background})`, backgroundRepeat: true }}
      className="w-full shadow-lg p-0 rounded-xl flex flex-1 h-full overflow-hidden flex-col items-center"
    >
      {chatID.id && <TitleBar setDialog={props.setDialog} />}
      <div
        ref={scrollable}
        onScroll={onScroll}
        className="mt-4  pb-4 pr-5 pl-5 flex flex-col w-full overflow-y-scroll overflow-visible  flex-1 bg-cover bg-repeat"
      >
        {m &&
          Object.values(m).map((message) => {
            const M = (
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
            return M;
          })}
      </div>
      {chatID.id && <MessageBar setReply={setReply} reply={reply} />}
    </div>
  );
}
