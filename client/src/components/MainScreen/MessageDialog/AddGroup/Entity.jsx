import { useCallback } from "react";
import { useCtx } from "../../AppScreen";
import Avatar from "../../../ui/Avatar";

export default function (props){
   const {profiles}=useCtx();
   const contact=profiles[props.id]
   const selected = props.members.has(props.id);
   const onClick=useCallback((event)=>{
     const next=new Set(props.members);
     if(next.has(props.id)) next.delete(props.id);
     else next.add(props.id);
     props.setMembers(next)
   },[props.members])

   return (contact)?
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-purple-50 cursor-pointer transition-colors" onClick={onClick}>
         <Avatar src={contact.img && contact.img.src} size="sm" />
         <div className="flex-1 min-w-0">
           <div className="truncate font-medium text-gray-800">{contact.name||"Unnamed"}</div>
           {contact.username && <div className="truncate text-xs text-gray-400">@{contact.username}</div>}
         </div>
         <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'}`}>
           {selected && <div className="w-2 h-2 rounded-full bg-white" />}
         </div>
       </div>
    :<></>
}
