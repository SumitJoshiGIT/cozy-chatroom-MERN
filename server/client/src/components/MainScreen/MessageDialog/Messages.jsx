import MessageBar from "./MessageBar/MessageBar";
import Message from "./MessageBar/Message/Message";
import {useRef,useEffect, useCallback, useState, useMemo} from "react";
import { useCtx } from "../AppScreen";
import socket from "../../Socket";

import backgroundImage from '/background.jpg';

export default function MessageDialog(props){
    const {Messages,chatID,scrollable}=useCtx()
    const onScroll=useCallback(function(){          
        if(scrollable.current&&scrollable.current.scrollTop<20){              
              socket.emit('messages',{cid:chatID.current,mid:Messages[0]?Messages[0]._id:null})
            }
        },[Messages])

    const messages=useMemo(()=>{return Messages.map((message,index)=>{
        return <Message key={message._id}  item={message} setDialog={props.setDialog} infoPanel={props.infoPanel}/>
           
    })},[Messages])

    return( 
        <div style={{ backgroundImage: `url(${backgroundImage})` }} className="w-full h-screen flex flex-col overflow-y-scroll flex-col">
        <div   ref={scrollable}
          onScroll={onScroll}
          className="pt-16 flex-1 pb-4 flex flex-col overflow-y-scroll flex-1 bg-cover bg-repeat">
          {messages}
        </div>
        {chatID && <MessageBar />}
      </div>
   
)
}
