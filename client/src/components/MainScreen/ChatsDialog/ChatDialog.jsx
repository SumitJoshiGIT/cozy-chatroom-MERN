import option from '/options.svg'
import React, { useState } from "react";
import Titlebar from "./TitleBar";

import Chats from "./Chats";
import { useCtx } from "../AppScreen";


const ChatDialogComponent = React.memo(function ({}) {
  const { setChatdata,socket, privateChats, profiles, userID,chatCache,isMobile} = useCtx();
  const [style,setStyle]=useState(1);

  // On mobile this is the only screen mounted (see AppScreen.jsx) - it
  // always takes the full screen, and always shows the expanded list
  // (a collapsed icon rail makes no sense as a dedicated full-screen view).
  const width = isMobile ? '100%' : (style ? '76px' : '320px');
  const effectiveStyle = isMobile ? 0 : style;

  return (
    <div className={isMobile ? "h-screen w-screen" : "h-screen pb-3 pt-3"}>
      <div
        style={{ width }}
        className={`flex flex-col items-center overflow-hidden h-full gradient-2 z-10 ${
          isMobile
            ? "p-3"
            : "p-3 border-gray-300 shadow-xl transition-all duration-300 rounded-e-2xl"
        }`}
      >
        <Titlebar setStyle={setStyle} style={effectiveStyle}/>
        {<Chats cache={chatCache} style={effectiveStyle} setStyle={setStyle}/>}
      </div>

    </div>

  );
});

export default ChatDialogComponent;
