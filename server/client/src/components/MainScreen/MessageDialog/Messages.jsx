import MessageBar from "./Message/MessageBar/MessageBar";
import Message from "./Message/Message";
import {useRef,useEffect, useCallback, useState, useMemo} from "react";
import { useCtx } from "../AppScreen";
import backgroundImage from '/background.jpg';
import socket from "../../Socket";

export default function MessageDialog(props){
    const {Messages,chatID,scrollable}=useCtx()
    const onScroll=useCallback(function(){
        if(scrollable.current&&scrollable.current.scrollTop<20){              
              socket.emit('messages',{cid:chatID.current,mid:Messages[0]._id})
              console.log('scroll',Messages)
            }
        },[Messages])

    const messages=useMemo(()=>{return Messages.map((message,index)=>{
        return <Message key={message.mid}  item={message} setDialog={props.setDialog} infoPanel={props.infoPanel}/>
           
    })},[Messages])

    return( 
     <div>  
      <div ref={scrollable} onScroll={onScroll}
         className="h-screen w-full overflow-x-hidden  bg-[url('background.jpg')]" style={{backgroundImage: `url(${backgroundImage})`}}>
        <div  
        className="pt-8 pb-32 flex flex-col w-full  overflow-y-scroll">
            {messages}    
        </div>
     </div>
     {(chatID)&&<MessageBar></MessageBar>}
    </div>
)
}
