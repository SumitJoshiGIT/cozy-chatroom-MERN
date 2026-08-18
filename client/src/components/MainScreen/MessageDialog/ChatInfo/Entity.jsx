import {useRef,useState,useEffect, useCallback} from "react";
import { useCtx } from "../../AppScreen";
import Avatar from "../../../ui/Avatar";
import IconButton from "../../../ui/IconButton";
import remo from '/remove.svg'
import promo from '/promote.svg';
import demo from '/demote.svg'
export default function (props){
   const {profiles,socket}=useCtx();
   const contact=profiles[props.id]||{}
   const owner=(props.chat.owner===props.id);
   const admin=owner||(props.chat.admins||[]).includes(props.id);
   const remove=useCallback(()=>{
     props.setMembers(prev=>new Set([...prev].filter(item=>item!==props.id)))
     socket.current.emit('removeUser',{chatID:props.chat._id, userID:props.id})
   },[])

   const promote=useCallback(()=>{
    socket.current.emit('promoteUser',{chatID:props.chat._id, userID:props.id})
  },[])

  const demote=useCallback(()=>{
    socket.current.emit('demoteUser',{chatID:props.chat._id, userID:props.id})
  },[])
    
   return <div className="mt-2 min-h-16 m-1 shadow-sm flex items-center min-w-62 hover:bg-gray-100 p-2 bg-white h-auto w-auto rounded-md" >
         <div className="h-full flex items-center">
           <Avatar src={contact.img && contact.img.src} size="sm" />
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
         <div className="flex items-center">
          { ((props.admin&&!admin)||(props.owner&&!owner))&&<IconButton icon={remo} alt="Remove" onClick={remove} />
          }
            {(props.owner)&&<IconButton icon={promo} alt="Promote" onClick={promote} />
            }
            {(props.owner)&&<IconButton icon={demo} alt="Demote" onClick={demote} />
            }
         </div>
         }
       </div>
}
