import {useRef,useState,useEffect, useCallback} from "react";
import socket from '../../../Socket'
import { useCtx } from "../../AppScreen";
import single from '/single.svg';
import group from '/group.svg';
import remo from '/remove.svg'
import promo from '/promote.svg';
import demo from '/demote.svg'
export default function (props){
   const {profiles}=useCtx();
   const contact=profiles[props.id]
   const owner=(props.chat.owner===props.id);
   const admin=owner||(props.id in props.chat.admins);
   
   const remove=useCallback(()=>{
     props.setMembers(prev=>new Set([...prev].filter(item=>item!==props.id)))
     socket.emit('removeUser',{chatID:props.chatID, userID:props.id})
   },[])

   const promote=useCallback(()=>{
    props.setMembers(prev=>new Set([...prev].filter(item=>item!==props.id)))
    socket.emit('promoteUser',{chatID:props.chatID, userID:props.id})
  },[])

  const demote=useCallback(()=>{
    props.setMembers(prev=>new Set([...prev].filter(item=>item!==props.id)))
    socket.emit('demoteUser',{chatID:props.chatID, userID:props.id})
  },[]) 
    
   return <div className=" mt-2 min-h-16 m-1 shadow-sm flex min-w-62 hover:bg-gray-100 p-2 bg-white h-auto w-auto rounded-md" >
         <div className=" h-full flex ">
           <img className=" w-16 h-12  rounded-full"
            src={(contact.img&&contact.img.src)||single} style={{backgroundColor:'white'}}>
           </img>
         </div>
         <div className="w-full rounded-md pl-4">
           <div className="justify-between ">
             <div className="truncate max-w-36  overflow-hidden text-ellipses  text-lg font-semibold">{contact.name||"Unnamed"}</div>
             <div  className="text-xs">{admin?'admin':(owner?'owner':'member')}</div>
           </div>
           <div className="text-gray-400 text-base">
           </div>
         </div>
         {(props.admin)&&
         <div className="flex"> 
          <div className=" h-full flex ">
          { ((props.admin&&!admin)||(props.owner&&!owner))&&<button onClick={remove} className="rounded-full m-2 outline-none active:outline-none border-none"><img src={remo} className="w-8 h-8 rounded-full"></img></button>
          }</div>
          <div className=" h-full flex ">
            {(props.owner)&&<button onClick={promote} className="rounded-full outline-none  m-2 active:outline-none border-none"><img src={promo} className="w-8 h-8 rounded-full"></img></button>
            }
          </div>
          <div className=" h-full flex ">
            {(props.owner)&&<button onClick={demote} className="rounded-full outline-none m-2 active:outline-none border-none"><img src={demo} className="w-8 h-8 rounded-full"></img></button>
            }
          </div>

         </div>
         } 
       </div>
}
