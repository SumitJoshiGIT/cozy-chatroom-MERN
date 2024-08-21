import TitleBar from "./TitleBar/TitleBar";
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
    <div  className="flex flex-col h-screen w-full overflow-hidden"> 
     {chatID.current&&<TitleBar setDialog={setDialog}/>}
     {<Component setDialog={setDialog} infoPanel={infoPanel}/>}
   </div>
)
})


export default MessageDialogComponent;