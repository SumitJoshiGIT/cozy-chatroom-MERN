import React, { useState, useEffect, useRef } from "react";
import Titlebar from "./TitleBar/TitleBar";
import Chats from "./Chats/Chats";
import Options from "./Options/Options";
import NewGroup from "./AddGroup/AddGroup";
import socket from "../../Socket";
import { useCtx } from "../AppScreen";

const obj = {
  0: Chats,
  1: Options,
  2: NewGroup,
};

const ChatDialogComponent = React.memo(function ({}) {
  const [dialog, setDialog] = useState(0);
  const { setChatdata, privateChats, profiles, userID, chatID } = useCtx();
  const Component = obj[dialog];
  const chatCache = useRef({ query: {}, chats: {} });

  useEffect(() => {
    socket.on("chat", (datagroup) => {
      let dict = {};
      datagroup.chats.forEach((data) => {
       if(data){ 
        if (data.type == "private") {
            data.users.forEach((uid) => {
             if (uid != userID.current) {
              privateChats.current[uid] = data._id;
              data.sender = uid;
              if (!profiles[uid])socket.emit("getProfile", { uid: uid });
          
             }
            });
          chatID.current.id = data._id;
        }
        dict[data._id] = data;
      }});

      const type = datagroup.type;
      if(datagroup.append)dict={...dict,...chatCache.current.query};
      chatCache.current[type] =type=="query" ?dict: { ...chatCache.current.chats, ...dict };
      setChatdata(chatCache.current[datagroup.type] || {});
    });
    socket.emit("chats", { curr: 0, type: "chats" });
  }, []);

  return (
      <div className="h-screen max-w-xs border-r flex flex-col border-gray-300 bg-white p-2 w-full overflow-hidden ">
 
        <Titlebar setDialog={setDialog} />
        {<Component cache={chatCache} setDialog={setDialog} />}
      </div>
    
  );
});

export default ChatDialogComponent;
