import socket from "../../../Socket"
import {useRef,useEffect, useState} from "react";
import group from '/group.svg'
import edit from '/edit.svg'
import Friends from "./Friends";
import ImageInput from "../../ImageInput";
import { useCtx } from "../../AppScreen";
export default function (props){

    const chatname=useRef('');
    const fileform=useRef({});
    const [chatnameSt,setUsername]=useState('');
    const [members,setMembers]=useState(new Set());
    return <div className='mt-6'>
    <div className='min-h-64 p-4 flex border-b  flex-col'>
       <ImageInput src={group} fileform={fileform} callback={()=>{}} editable={true}/>
      <div className='flex flex-col w-full'>
        <input  placeholder="Chatname..." ref={chatname} 
        onChange={(event)=>setUsername(event.target.value)} 
        onBlur={()=>{}}  className='max-w-64  mr-1 pl-2 p-1 border-b border-b-gray-300 rounded-sm w-fit mt-4  text-sm outline-none' value={chatnameSt} required/>
        
        <button onClick={()=>{
         fileform.current.name=chatnameSt;
         console.log(members.keys())
         fileform.current.members=[...members.keys()];
         socket.emit('createChat',fileform.current);
         props.setDialog(0)
        }} className="border-2 outline-none w-fit pl-3 pr-3 text-sm bg-gray-200 shadow rounded mt-2">Create</button>
      </div>
      <div className="text-sm p-1 pl-2  w-fit pr-3 mb-4 mt-4 font-semibold border-l-2 rounded shadow-sm">Add Members</div>
       <Friends members={members} setMembers={setMembers}/>     
    </div>
</div> 

}