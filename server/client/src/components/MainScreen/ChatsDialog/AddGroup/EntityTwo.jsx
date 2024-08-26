import {useRef,useState,useEffect, useCallback} from "react";
import { useCtx } from "../../AppScreen";
import single from '/single.svg';
import group from '/group.svg';
import close from '/close.svg'
export default function (props){
   const {profiles}=useCtx();
   const contact=profiles[props.id]
   const onClick=useCallback((event)=>{
     const obj=props.members;
     obj.delete(props.id);
     console.log(obj)
     props.setMembers(new Set(...obj))          
   },[props.members])
   

   return (contact)?<div className="  m-1 shadow-sm flex   hover:bg-gray-100 p-1 bg-white text-xs h-fit w-auto rounded-full">
         <div className="w-fit rounded-md ">
           <div className="flex justify-center items-baseline ">
             <div className="truncate text-xs  font-semibold">{contact.name||"Unnamed"}</div>
           </div>
           <div className="text-gray-400 text-base">
           </div>
         </div>
         <button className="rounded-full ml-1" onClick={onClick}><img className='h-3'src={close}></img></button>
         </div>:<></>
}
