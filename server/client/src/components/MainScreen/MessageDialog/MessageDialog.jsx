import React,{useRef,useMemo,useEffect, useCallback, useState} from "react";
import { useCtx } from "../AppScreen";
import socket from "../../Socket";
import Messages from "./Messages";
import TitleBar from "./TitleBar";
import ChatInfo from "./ChatInfo/ChatInfo";
import UserInfo from "./UserInfo/UserInfo";
//import UserInfo from "../ChatsDialog/UserInfo/UserInfo";
const dialogs={
    1:Messages,
    0:ChatInfo,
    2:UserInfo
    }
  
const  MessageDialogComponent=React.memo(function MessageDialog({}){
    const [dialog,setDialog]=useState(0);
    const infoPanel=useRef('');
    const {chatID}=useCtx()
    const Component=dialogs[dialog]  
    return( 
    <div className="p-4 h-screen w-full flex flex-col flex-1">
     <TitleBar setDialog={setDialog}/>
     <div  className="flex rounded-lg  flex-col flex-1 w-full overflow-hidden"> 
     
     <div className="rounded-lg flex w-full h-full p-2">
       {<Component setDialog={setDialog} infoPanel={infoPanel}/>}
     </div>
     </div> 
   </div>
)
})


export default MessageDialogComponent;