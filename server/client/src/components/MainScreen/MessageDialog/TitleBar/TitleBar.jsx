import { useState,useEffect,useRef,useMemo } from "react";
import { useCtx } from "../../AppScreen";
import single from '/single.svg'
import group from '/group.svg'
export default function (props){
    
    const {chatID,chatdata,userID,profiles}=useCtx()
    let chat=chatdata[chatID.current]||{};
    const [status,setStatus]=useState('')
    if(chat.type=='private'){
      let user=undefined;
      chat.users.forEach((uid)=>{if(uid!=userID.current)user=uid}) 
      chat={...chat,...(profiles[user]||{})};
    }
     useEffect(()=>{
      setStatus((chat.type=='private')?'private':`${(chat.users&&chat.users.length)} member`)
     
    },[chat])
   return( <div className="flex sticky shadow-md  p-2 pl-4 justify-content items-center  h-14 bg-white w-full">
         <button onClick={()=>{
          props.setDialog((prev)=>(prev+1)%2);}} className="outline-none  border-none rounded-full h-fit w-fit"> 
           <img className=" w-10 h-10 border p-1  rounded-full"
            src={chat.img||(chat.type=='private')?single:group} style={{backgroundColor:'white'}}>
           </img>
         </button>        
        <div className="p-2 flex flex-col ">
         <div className="text-sm font-semibold">{chat.name||"Unnamed"}</div>
         <div className="text-xs text-gray-400">{status}
         </div>
        </div>
        <button></button>
    </div>);
}