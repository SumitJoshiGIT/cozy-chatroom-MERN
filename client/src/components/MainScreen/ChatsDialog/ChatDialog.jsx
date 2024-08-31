import option from '/options.svg'
import React, { useState, useEffect, useRef } from "react";
import Titlebar from "./TitleBar";

import Chats from "./Chats";
import { useCtx } from "../AppScreen";


const ChatDialogComponent = React.memo(function ({}) {
  const { setChatdata,socket, privateChats, profiles, userID,chatCache} = useCtx();
  const [style,setStyle]=useState(1);
  const [position, setPosition] = useState(window.innerWidth<600?{position:'fixed'}:{});
  useEffect(() => {
    //socket.current.emit("chats", { curr: 0, type: "chats" });
    const onResize=()=>{
      if(window.innerWidth<=600)setPosition({position:'fixed'});
      else setPosition({});

    }
    window.addEventListener('resize',onResize)
  
  }, []);
  
   
  return (
    <div className="h-screen pb-3 pt-3">
      <div style={style==1?{width:'fit-content',padding:'1px',minWidth:'20px'}:{...position}} className="w-sm max-w-sm p-4  flex-col  border-gray-300 shadow-xl   w-full overflow-hidden transition-2s h-full rounded-e-2xl gradient-2  z-10">
        <Titlebar setStyle={setStyle} style={style}/>
        {<Chats cache={chatCache} style={style} setStyle={setStyle}/>}
      </div>
    
    </div>  
    
  );
});

export default ChatDialogComponent;
