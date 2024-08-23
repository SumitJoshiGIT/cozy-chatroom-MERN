import React,{useRef,useMemo,useEffect, useCallback, useState} from "react";
import { useCtx } from "../AppScreen";
import socket from "../../Socket";
import Messages from "./Messages";
import ChatInfo from "./ChatInfo/ChatInfo";
import UserInfo from "./UserInfo/UserInfo";
const dialogs={
    0:Messages,
    1:ChatInfo,
    2:UserInfo
    }
  
const  MessageDialogComponent=React.memo(function MessageDialog({}){
    const [dialog,setDialog]=useState(0);
    const infoPanel=useRef('');
    const {chatID}=useCtx()
    const Component=dialogs[dialog]  
    return( 
    <div className="p-4 h-screen w-full flex-1">
     <div  className="flex rounded-lg  flex-col h-full w-full overflow-hidden"> 
     
     <div className="rounded-lg flex  h-full p-2">
       {<Component setDialog={setDialog} infoPanel={infoPanel}/>}
     </div>
     </div> 
   </div>
)
})


export default MessageDialogComponent;