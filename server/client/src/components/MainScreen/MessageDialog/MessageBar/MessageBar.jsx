import React from "react";
import { useState,useRef,useEffect} from "react";
import { useCtx }  from "../../AppScreen";
import Message from './Message/Message';
import socket from '../../../Socket'
import send from '/send.svg';
let k=0;
export default function MessageBar(props) {
      const [message, setMessage] = useState("");
      const ref=useRef(null);
      
      const {setMessages,Messages,scrollable,userID,chatID}=useCtx()
      async function SendMessage(event){
              event.preventDefault();
              let msg={
                _id:new Date(),
                uid:userID.current,
                content:message,
                time:new Date(),
                status:'⧖'
              };
              setMessages([...Messages,msg]);
              console.log((chatID.current ))
              socket.emit((chatID.current.type=='user')?'createChatPrivate':'sendMessage',{cid:chatID.current.id,content:message})
              setMessage("");
              scrollable.current.scrollTo(0,scrollable.current.scrollHeight);
            }
      return (
      <div className=" m-4 overflow-x-hidden background-transparent">
        <div className="p-1 rounded-md  bg-gray-100 w-full flex items-end">
         <textarea rows='1' onKeyDown={(event)=>{
            if(event.ctrlKey&&event.key=='Enter')SendMessage(event);
            }} ref={ref} onInput={function(){
          ref.current.style.height='auto';
          
          ref.current.style.height=ref.current.scrollHeight+'px';
         }} className="rounded-md align-bottom bg-gray-100 text-sm max-h-36 w-full outline-none border-none min-h-11 h-auto  p-2 text-gray-500 resize-none" placeholder="Write your message..." type="text" onChange={(event)=>setMessage(()=>event.target.value)} value={message}> 
         </textarea>
         <img  src={send} className="m-2 w-10 h-6 " onClick={SendMessage}></img>
        </div>
      </div>
      )

}
