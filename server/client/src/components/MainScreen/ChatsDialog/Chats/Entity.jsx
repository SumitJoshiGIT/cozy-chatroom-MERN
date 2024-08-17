import {useRef,useState,useEffect, useCallback} from "react";
import socket from '../../../Socket'
import { useCtx } from "../../AppScreen";
import single from '/single.svg';
import group from '/group.svg';

export default function (props){
   const {setMessages,profiles,chatdata,scrollable,userID,chatID}=useCtx();
   const messages=useRef({});
   let chat=chatdata[props.id];
   const [latest,setLatest]=useState('')
  
   if(chat.type=='private'){
      let user=undefined;
      chat.users.forEach((uid)=>{if(uid!=userID.current)user=uid}) 
      chat={...chat,...(profiles[user]||{})};
   }
   
   useEffect(()=>{
      socket.emit('messages',{cid:props.id,mid:messages.current[0]})

      socket.on(`message.${props.id}`,(data)=>{  
         if(data){  
         const flag=Array.isArray(data);
         if(flag)data.map((data)=>{
            messages.current[data.mid]=data
            if(!profiles[data.uid])socket.emit('getProfile',{uid:data.uid}); 
         })
         else{
            messages.current[data.mid]=data;
            if(!profiles[data.uid])socket.emit('getProfile',{uid:data.uid}); 
         }
         const updated=Object.values(messages.current);
         if(chatID.current==props.id){
            setMessages(updated);
         }
         setLatest(updated[updated.length-1])
      }})  
   },[])
   
   const onClick=useCallback((event)=>{
      chatID.current=props.id;
      setMessages(Object.values(messages.current));
   })

   
   return <div className=" mt-5 min-h-16 m-2 shadow-sm flex min-w-62 w-62 overflow-hidden hover:bg-gray-100 p-2 bg-white h-auto w-auto rounded-md" onClick={onClick}>
         <div className=" h-full flex ">
           <img className=" min-w-16 w-16 p-1 h-12  rounded-full"
            src={(chat.img&&chat.img.src)||(chat.type=='private')?single:group} style={{backgroundColor:'white'}}>
           </img>
         </div>
         <div className="w-full rounded-md pl-4">
           <div className="flex justify-between ">
             <div className="overflow-hidden text-ellipses text-lg w-54 font-semibold">{chat.name||"Unnamed"}</div>
           </div>
           <div className="text-gray-400 text-base">
           {(latest)&&
           <div className="flex  justify-between overflow-hidden w-full">
              <div className="truncate w-56 text-base " >
               <span style={{color:(profiles[latest.uid])?profiles[latest.uid].color:""}}>{(profiles[latest.uid])?profiles[latest.uid].name:" "}:</span>
               <span className="overflow-clip text-ellipsis ">{latest.content}</span></div>
              <div className="text-base">{new Date(latest.updatedAt).getHours()}:{new Date(latest.updatedAt).getMinutes()}</div>    
           </div>
           }           
           </div>
         </div>
         <div className="m-2 h-full flex ">
            
         </div>
       </div>
}
