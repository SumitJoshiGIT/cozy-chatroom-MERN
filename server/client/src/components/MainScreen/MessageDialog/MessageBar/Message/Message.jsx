import React from "react";
import { useState,useEffect,useCallback} from "react";
import Placeholder from "/person.svg"; 
import { useCtx } from "../../../AppScreen";
import socket from '../../../../Socket'

export default function (props){
  const {profiles,userID}=useCtx()
  useEffect(()=>{ 
    if(!profiles[messageItem.uid])
      {socket.emit('getProfile',{uid:messageItem.uid})}; 
   },[])
  
   const messageItem=props.item;
   const profile=profiles[messageItem.uid]||{};
   const time=(new Date(messageItem.updatedAt));
   const flag=messageItem.uid==userID.current;
   const onClick=useCallback(()=>{
        props.infoPanel.current=messageItem.uid;
        props.setDialog(2);
        
   },[profile])
   //
   //<div style={{backgroundColor:((flag)?'#EEFFDE':'white'),maxWidth:'500px'}} className="relative top-1 h-3 w-2 message-clip"></div>
   return <div  className={`w-full flex  p-5 justify-${flag?"end":"start"}`}>
       <div className="m-2  h-full flex ">
       <button onClick={onClick} className="rounded-full h-fit p-1 border border-gray-300 w-fit">
        <img className="min-h-8 min-w-8 w-8  box-shadow border-1 h-8 rounded-full"
        src={profile.img||Placeholder} style={{backgroundColor:'white'}}></img>
       </button>
       </div>
       <div className="shadow-sm"> 
        <div style={{backgroundColor:((flag)?'#EEFFDE':'white'),maxWidth:'500px'}} className=" p-2 pl-3 pr-1 pb-0 rounded-md border" >
         <div style={{color:(profile.color||'red')}} className="text-xs font-semibold">{profile.name}</div>
         <div className="h-auto text-sm">
          {messageItem.content}
         </div>
         <div className="flex flex-row-reverse text-gray-400 text-xs">
          <div className="m-1 mr-0 ">{messageItem.status||'✔'}</div>
          <div className="m-1 text-grey">{time.getHours()}:{time.getMinutes()} </div>
        
         </div>

     </div>
     </div>
     </div>


};