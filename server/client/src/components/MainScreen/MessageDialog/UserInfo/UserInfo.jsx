import React,{useRef,useMemo,useEffect, useCallback, useState} from "react";
import { useCtx } from "../../AppScreen";
import socket from "../../../Socket";
import ImageInput from "../../ImageInput";
import single from '/single.svg'
import edit from '/edit.svg'
export default function (props){
    const {profiles,contacts,setContacts,userID}=useCtx();
    const fileform=useRef({});
    const [profile,setProfile]=useState(profiles[props.infoPanel.current]||{})
    console.log(profile)
    useEffect(()=>{
         if(profiles[props.uid]){
           setProfile(profiles[props.uid])
         }
    },[profiles])
    const addFriend=useCallback(()=>{
      socket.emit('addFriend',{uid:profile._id})
  
    })
    const removeFriend=useCallback(()=>{
      socket.emit('removeFriend',{uid:profile._id})
    })
    const component=useMemo(()=>{
      return (profile._id!=userID.current)&&
      <button className='text-sm border border-gray-300  mt-4 p-2 w-32 rounded' onClick={()=>{}}>{(contacts.has(profile._id))?'Remove Friend':'Add Friend'}</button>
    })

    return <div className='mt-6'>
         <div className='min-h-64 p-4 flex border-b  flex-col'>
           <ImageInput src={profile.img?(`/${profile.img.src}`):single} uneditable={true} fileform={fileform} callback={()=>{}}/> 
           
           <div className=' flex  w-full items-baseline'>
             <div style={{borderColor:profile.color}} className='  max-w-64 border-l-4  mr-1 pl-2 text-bold rounded w-fit text-start  mt-4 text-2xl outline-none'>
              {profile.name}
             </div>
           </div>
           <div className='  w-full  mt-4 text-gray-400 items-baseline text-base '>        
             <div  className='outline-none  pl-2 max-w-64  mr-1 rounded w-fit text-start   text-base pl-2'>
             {profile.about}
             </div>
           </div>
           
          {component}
    </div> 
 </div>
 }