import {useRef,useEffect, useState} from "react";
import group from '/group.svg'
import back from '/close.svg'
import background from '/background.jpg'
import Friends from "./Friends";
import ImageInput from "../../ImageInput";
import { useCtx } from "../../AppScreen";
import tick from "/tick.svg";
export default function (props){
    const {socket,setMessageDialog}=useCtx();
    const chatname=useRef('');
    const fileform=useRef({});
    const [chatnameSt,setUsername]=useState('');
    const [members,setMembers]=useState(new Set());
    return <div className=' max-w-xl bg-white w-full h-full rounded-xl overflow-hidden shadow-md'>
    <div className='min-h-64 h-full flex border-b  flex-col'>
    <div style={{
          backgroundImage:`url(${background})`,
        
        }}  className="bg-gray-200 flex-col rounded-t-xl flex items-center justify-center  w-full h-44 ">
      <div className="w-full"><button className="mt-5 ml-2 absolute z-10 rounded-full  bg-white" onClick={()=>setMessageDialog(0)}><img className="w-8  h-10" src={back}/></button>
      </div>
      <div className="relative top-20 border-1 flex-col w-36 h-fit flex ">
       <ImageInput src={group} fileform={fileform} callback={()=>{}} editable={true}/>
       <input className="border border-black text-center w-full mt-4  text-sm  color-gray-500  bg-transparent rounded-full  p-1 " placeholder="Chatname" ref={chatname} 
        onChange={(event)=>setUsername(event.target.value)} 
        onBlur={()=>{}}   value={chatnameSt} required/>
        
      </div>
      </div>
      <div className='flex flex-col mt-20 w-full'>
        
      </div>
      <div className="h-full flex-1 p-3  rounded-t-xl ">     
            <Friends members={members} setMembers={setMembers}/>     
      </div>
      <div className="w-full flex pr-10 overflow-visible  flex-row-reverse">
      <button onClick={()=>{
         fileform.current.name=chatnameSt;
         console.log(members.keys())
         fileform.current.members=[...members.keys()];
         socket.current.emit('createChat',fileform.current);
         setMessageDialog(0);
        }} className="max-w-64 absolute min-w-7 min-h-7  bottom-10 bg-gray-300 shadow-md  rounded-full p-2  w-fit ">

          <img className="w-7  h-7 " src={tick}/>
        </button>
        </div>
    </div>
</div> 

}