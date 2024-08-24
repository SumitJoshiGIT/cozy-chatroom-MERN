import {useRef,useState,useEffect, useCallback} from "react";
import socket from '../../../Socket'
import { useCtx } from "../../AppScreen";
import single from '/single.svg';
import group from '/group.svg';

export default function (props){
   const {profiles}=useCtx();
   const contact=profiles[props.id]
   const onClick=useCallback((event)=>{
     props.setMembers(new Set([...props.members,props.id]))
   })
   

   return (contact)?<div className=" mt-2  m-1 shadow-sm flex min-w-62 hover:bg-gray-100 p-3 bg-white h-auto w-auto rounded-md" onClick={onClick}>
         <div className=" h-full flex ">
           <img className=" w-12 h-8 border rounded-full"
            src={(contact.img&&contact.img.src)||single} style={{backgroundColor:'white'}}>
           </img>
         </div>
         <div className="w-full rounded-md pl-4">
           <div className="flex justify-between ">
             <div className="truncate   text-lg font-semibold">{contact.name||"Unnamed"}</div>
           </div>
           <div className="text-gray-400 text-base">
           </div>
         </div>
         <div className="m-2 h-full flex ">
            
         </div>
       </div>:<></>
}
