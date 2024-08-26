import React, { useState, useEffect, useRef } from "react";
import Titlebar from "./TitleBar/TitleBar";
import Chats from "./Chats/Chats";
import { useCtx } from "../AppScreen";


const ChatDialogComponent = React.memo(function ({}) {
  const { setChatdata,socket, privateChats, profiles, userID,chatCache} = useCtx();
  const [style,setStyle]=useState(1);
  useEffect(() => {
    socket.current.emit("chats", { curr: 0, type: "chats" });
  }, []);
  

  return (
      <div  style={style?{width:'fit-content',padding:'1px',minWidth:'20px'}:{}} className="h-screen max-w-sm p-4  flex-col  border-gray-300 shadow-xl   w-full overflow-hidden transition-2s rounded-e-2xl  gradient-2">
 
        <Titlebar setStyle={setStyle} style={style}/>
        {<Chats cache={chatCache} style={style}/>}
      </div>
    
  );
});

export default ChatDialogComponent;
