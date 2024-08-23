import { useState,useEffect,useRef,useMemo } from "react";
import { useCtx } from "../../AppScreen";
import single from '/single.svg'
import group from '/group.svg'
export default function (props){
    
    const {chatID,privateChats,chatdata,userID,profiles}=useCtx()
    let chat=chatdata[chatID.current.id]||{};
    const [status,setStatus]=useState('')
 
     useEffect(()=>{
      setStatus((chat.type=='group')?`${(chat.users&&chat.users.length)} member`:chat.type)
     
    },[chat])
   return( <div className=" min-w-36 shadow-lg m-3 rounded-lg  p-2   pl-4 justify-content items-center  h-14 bg-white flex">
         <button onClick={()=>{
          props.setDialog((prev)=>(prev+1)%2);}} className="outline-none  border-none rounded-full h-fit w-fit"> 
           <img className=" w-10 h-10 border p-1  rounded-full"
            src={chat.img||(chat.type!='group')?single:group} style={{backgroundColor:'white'}}>
           </img>
         </button>        
        <div className="p-2 flex flex-col ">
         <div className="text-sm w-36 text-ellipses font-semibold">{chat.name||"Unnamed"}</div>
         <div className="text-xs text-gray-400">{status}
         </div>
        </div>
        <button></button>
    </div>);
}