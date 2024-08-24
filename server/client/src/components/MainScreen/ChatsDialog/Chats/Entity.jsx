import {useRef,useState,useEffect, useCallback} from "react";
import socket from '../../../Socket'
import { useCtx } from "../../AppScreen";
import single from '/single.svg';
import group from '/group.svg';

export default function (props){
   const {setMessages,profiles,chatdata,setChatdata,scrollable,chatID,privateChats}=useCtx();
   const messages=useRef({});
   const [chatid,setId]=useState(props.id);
   let chat=chatdata[chatid];
  //  if(!chat){return <>{props.id}</>}
   let sender=chat.sender
  
   const [latest,setLatest]=useState('')
   useEffect(()=>{
      const profile=profiles[chat.sender]
      if(profile){
       delete profile['_id'];
       setChatdata((prev)=>{
         prev[chat._id]={...chat,...profile}
         return prev
      });
      }
      else socket.emit('getProfile',{uid:chat.sender})    
      
   },[profiles])

   
   const onClick=useCallback((event)=>{
      chatID.current.id=chat._id;
      chatID.current.type=chat.type;
      
      setMessages(Object.values(messages.current));
      
   })
   useEffect(()=>{
      if(chat.type!='user'){
         socket.emit('messages',{cid:chat._id,mid:messages.current[0]})
  
      socket.on(`message.${chat._id}`,(data)=>{
         console.log(data)  
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
         
         if(chatID.current.id==chat._id){
            setMessages(updated);
            scrollable.current.scrollTo({top: scrollable.current.scrollHeight, behavior: 'smooth' });
         }
         setLatest(updated[updated.length-1])
      }})
   }
   else{
      socket.on(`private.${chat._id}`,(newchat)=>{
         console.log('private',newchat)
         setChatdata((prev)=>{  
            newchat.sender=chat._id;
            props.cache.current.chats[newchat._id]=newchat;
            if(prev[chat._id])delete prev[chat._id];
            privateChats.current[chat._id]=newchat._id
            console.log('new',newchat)
            if(chatID.current.id==chat._id){
               chatID.current.id=newchat._id;
               chatID.current.type='private';
               setMessages(Object.values(messages.current));
          
            }
            prev[newchat._id]={...chat,...newchat};
            return prev;
         })
        setId(newchat._id);
        console.log(chatid)
      })
   }
   },[chatid])
   

   
   return <div className="min-h-16 m-2 shadow-md flex min-w-62 w-62 overflow-hidden hover:bg-gray-100 p-2 bg-white h-auto w-auto rounded-md" onClick={onClick}>
         <div className=" h-full flex  justify-content items-center">
           <img className=" min-w-12 w-12 h-12 border  rounded-full"
            src={(chat.img&&chat.img.src)||(chat.type!='group')?single:group} style={{backgroundColor:'white'}}>
           </img>
         </div>
         <div className="w-full rounded-md overflow-hidden pl-4">
           <div className="flex justify-between ">
             <div className="overflow-hidden text-ellipses text-lg w-54 font-semibold">{chat.name||"Unnamed"}</div>
           </div>
           <div className="text-gray-400 text-base flex">
           {(latest)&&
           <div className="flex  justify-between overflow-hidden w-full">
              <div className="truncate w-56 text-sm " >
               <span style={{color:(profiles[latest.uid])?profiles[latest.uid].color:""}}>{(profiles[latest.uid])?profiles[latest.uid].name:" "}:</span>
               <span className="overflow-clip text-ellipsis ">{latest.content}</span></div>  
               <span className="text-xs flex items-center ml-1">{new Date(latest.updatedAt).getHours()}:{new Date(latest.updatedAt).getMinutes()}</span> 
         
           </div>
           }           
           </div>
         </div>
         <div className="m-2 h-full flex ">
            
         </div>
       </div>
}
