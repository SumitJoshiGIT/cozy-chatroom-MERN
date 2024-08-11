import React from "react";
import { useState,useEffect} from "react";
import Placeholder from "./person.svg"; 
import { useCtx } from "../../AppScreen";
import socket from '../../../Socket'

export default function Message(props){
    const {profiles,userID}=useCtx()
    const messageItem=props.item;
    const [profile,changeProfile]=useState({});
    const [message,changeMessage]=useState(messageItem.content);
    const [status,changeStatus]=useState(messageItem.status||'✔');
    const [time,changeTime]=useState(new Date(messageItem.updatedAt));
    
    socket.on(`profile.${messageItem.uid}`,(data)=>{
     if(data){ profiles.current[messageItem.uid]=data;
      changeProfile(data);
    }
   })
    useEffect(()=>{ 
     
     if(profiles[messageItem.uid])changeProfile(profiles[messageItem.uid]);
     else{
      socket.emit('getProfile',{uid:messageItem.uid,cid:messageItem.chat}); 
    }
    },[])
    const flag=messageItem.uid==userID.current;
    return <div  className={`w-full flex  p-5 justify-${flag?"end":"start"}`}>
       <div className="m-2 shadow-md h-full flex ">
        <img className="min-h-8 min-w-8 w-8 p-1 box-shadow h-8 rounded-full"
        src={profile.img||Placeholder} style={{backgroundColor:'white'}}></img>
       </div>
       <div style={{backgroundColor:((flag)?'#EEFFDE':'white'),maxWidth:'500px'}}className="p-2 pb-0 rounded-md " >
         <div style={{color:(profile.color||'red')}} className="text-xs font-semibold">{profile.name}</div>
         <div className="h-auto text-sm">
          {message}
         </div>
         <div className="flex flex-row-reverse text-gray-400 text-xs">
          <div className="m-1 mr-0">{status}</div>
          <div className="m-1 text-grey">{time.getHours()}:{time.getMinutes()} </div>
        
         </div>

     </div>
     </div>


};