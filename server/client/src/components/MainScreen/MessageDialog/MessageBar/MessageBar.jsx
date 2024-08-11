import React from "react";
import { useState,useRef,useEffect} from "react";
import { useCtx }  from "../../AppScreen";
import Message from '../Message/Message';
import socket from '../../../Socket'
import send from './send.svg';
let k=0;
export default function MessageBar(props) {
      const [message, setMessage] = useState("");
      const ref=useRef(null);
      const {chatID}=useCtx();
      const {setMessages}=useCtx()
      async function SendMessage(event){
              event.preventDefault();
              let time=new Date();
              socket.emit('sendMessage',
              {chat:chatID.current,content:message}
              )
              setMessage("");
            }

      return (
      <div className="sticky bottom-0 w-full">
        <div className="p-1  flex bg-white w-full flex items-end">
         <textarea rows='1' ref={ref} onInput={function(){
          ref.current.style.height='auto';
          
          ref.current.style.height=ref.current.scrollHeight+'px';
         }} className=" text-md  max-h-36 w-full outline-none border-none min-h-11 h-auto m-2 p-2  resize-none" placeholder="Write your message..." type="text" onChange={(event)=>setMessage(()=>event.target.value)} value={message}> 
         </textarea>
         <img  src={send} className="m-2 w-10 h-6 " onClick={SendMessage}></img>
        </div>
      </div>
      )

}
