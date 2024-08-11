import {useRef,useState,useEffect} from "react";
import socket from '../../../Socket'
import { useCtx } from "../../AppScreen";
export default function (props){
   const {setMessages,chatID,scrollable}=useCtx();
   const messages=useRef([]);
   useEffect(()=>{
      socket.emit('messages',{cid:props.cid,mid:messages[0]})
      socket.on(`message.${props.cid}`,(data)=>{  
         if(data){  
          const updated=[...data,...messages.current];
          messages.current=updated; 
          console.log(messages.current)
          if(chatID.current==props.cid){
            setMessages(updated);
            console.log('set')       
         }
         }
      })  
       

   },[])


   
   return <div className="min-h-16 m-2 shadow-sm flex min-w-62 hover:bg-gray-100 p-2 bg-white h-auto w-auto rounded-md" onClick={(event)=>{
                     chatID.current=(props.cid);
                     setMessages([...messages.current]);
         }}>
         <div className=" h-full flex ">
          <img className=" w-10 h-10  rounded-full"
          src={props.img} style={{backgroundColor:'white'}}></img>
         </div>
         <div className="w-full rounded-md">
           <div className="flex justify-between ">
             <div className="truncate text-red-400  text-base font-semibold">{props.name}</div>
              <div className="text-xs text-blue-500">{props.time}</div>
           </div>
           <div className="text-sm">
           <div className="flex  justify-between w-full">
              <div className="truncate text-base ">{props.currentMsg}</div>
              <div className="rounded-lg p-1 text-white  text-s bg-gray-400">{props.unread}</div>
           </div> 
          </div>
         </div>
         <div className="m-2 h-full flex ">
            
            <div></div>    
         </div>
       </div>
}
