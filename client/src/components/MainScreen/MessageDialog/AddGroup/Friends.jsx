import { useState,useRef, useMemo} from "react";
import Entity from "./Entity";
import { useCtx } from "../../AppScreen";
import EntityTwo from "./EntityTwo";
import { TextField } from "../../../ui/TextField";
import Spinner from "../../../ui/Spinner";

export default function (props){
    const {contacts,profiles,contactsLoaded}=useCtx()
    const ref=useRef();
    const [query,setQuery]=useState('');
    const onChange=(event)=>{
      setQuery(event.target.value);
    }

    const friends=useMemo(()=>{
      const k=new Array(...contacts).filter((id)=>{
        if(!query.trim()) return true;
        const name=(profiles[id]&&profiles[id].name)||'';
        return name.toLowerCase().includes(query.trim().toLowerCase());
      })
      return k.map((data)=>{return <Entity key={data} members={props.members} setMembers={props.setMembers} id={data}/>})
    },[contacts,profiles,query,props.members])

    const additions=useMemo(()=>{
       return (new Array(...props.members)).map((member)=><EntityTwo id={member} key={member} members={props.members} setMembers={props.setMembers}></EntityTwo>)
    },[props.members])

    return(
    <div className="h-full flex-1 flex flex-col w-full min-h-0">
     {props.members.size > 0 && (
       <div className="flex gap-3 overflow-x-auto px-1 pb-3 mb-1 border-b border-gray-100 shrink-0">
         {additions}
       </div>
     )}
     <TextField ref={ref} placeholder='Search people' className="w-full shrink-0" onChange={onChange}/>
     <div className="flex flex-col flex-1 min-h-0 overflow-y-auto mt-2">
       {!contactsLoaded ? (
         <div className="flex justify-center mt-6"><Spinner /></div>
       ) : friends.length > 0 ? friends : (
         <div className="text-center text-sm text-gray-400 mt-6">
           {contacts.size === 0 ? "Message someone to add them here." : "No matches."}
         </div>
       )}
     </div>
    </div>
    );
}
