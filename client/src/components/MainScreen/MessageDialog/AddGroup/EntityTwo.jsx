import { useCallback } from "react";
import { useCtx } from "../../AppScreen";
import Avatar from "../../../ui/Avatar";
import close from '/close.svg'

export default function (props){
   const {profiles}=useCtx();
   const contact=profiles[props.id]
   const onClick=useCallback((event)=>{
     event.stopPropagation();
     const next=new Set(props.members);
     next.delete(props.id);
     props.setMembers(next)
   },[props.members])

   return (contact)?
      <div className="flex flex-col items-center gap-1 w-14 shrink-0 animate-pop-in">
         <div className="relative">
           <Avatar src={contact.img && contact.img.src} size="sm" />
           <button
             onClick={onClick}
             className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-500 hover:bg-red-500 transition-colors flex items-center justify-center"
           >
             <img className="w-2 h-2 invert" src={close} alt="Remove" />
           </button>
         </div>
         <div className="truncate text-xs text-gray-600 w-full text-center">{contact.name||"Unnamed"}</div>
       </div>
    :<></>
}
