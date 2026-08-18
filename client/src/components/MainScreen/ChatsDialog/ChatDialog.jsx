import option from '/options.svg'
import React, { useState, useEffect, useRef } from "react";
import Titlebar from "./TitleBar";

import Chats from "./Chats";
import { useCtx } from "../AppScreen";


const ChatDialogComponent = React.memo(function ({}) {
  const { setChatdata,socket, privateChats, profiles, userID,chatCache} = useCtx();
  const [style,setStyle]=useState(1);
  const [position, setPosition] = useState(window.innerWidth<700?{position:'fixed'}:{});
  useEffect(() => {
    //socket.current.emit("chats", { curr: 0, type: "chats" });
    const onResize=()=>{
      if(window.innerWidth<=600)setPosition({position:'fixed'});
      else setPosition({});

    }
    window.addEventListener('resize',onResize)
  
  }, []);
  
   
  return (
    <div className="h-screen pb-3 pt-3 ">
      <div style={style?{...position,width:'76px'}:{...position,width:'320px'}} className="flex flex-col items-center p-3 border-gray-300 shadow-xl overflow-hidden transition-all duration-300 h-full rounded-e-2xl gradient-2 z-10">
        <Titlebar setStyle={setStyle} style={style}/>
        {<Chats cache={chatCache} style={style} setStyle={setStyle}/>}
      </div>

    </div>

  );
});

export default ChatDialogComponent;
