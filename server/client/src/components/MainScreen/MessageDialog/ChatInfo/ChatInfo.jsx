import single from '/single.svg';
import { useRef ,useEffect,useState,useCallback,useMemo} from 'react';
import { useCtx } from '../../AppScreen.jsx';
import edit from '/edit.svg';
import socket from '../../../Socket.js';
import ImageInput from '../../ImageInput.jsx';
import Entity from './Entity.jsx';
export default function (){
   const {chatdata,chatID,profiles,userID}=useCtx();
   const about=useRef();
   const chatname=useRef();
   let chat=chatdata[chatID.current]||{}
   const [aboutSt,setAbout]=useState(chat.about||"null");
   const [chatnameSt,setUsername]=useState(chat.name||'');
   const [members,setMembers]=useState((chat.users)||[])
  
   useEffect(()=>{    
    if(chat.type=='private'){
      let user=undefined;
      chat.users.forEach((uid)=>{if(uid!=userID.current)user=uid}) 
      chat={...chat,...(profiles[user]||{})};
      chat.users=[];
    }
    setAbout(chat.about||"null");
    setUsername(chat.name||'');
    setMembers(chat.users||''); 
  },[profiles,chat])

   const fileform=useRef({});
   
   return <div className='mt-6'>
        <div className='min-h-64 p-4 flex   flex-col'>
          <div className='border-1 w-fit h-fit flex items-baseline rounded-full'>
           <ImageInput src={(chat.img)?chat.img.src:single} fileform={fileform} uneditable={true} callback={
            ()=>{
              socket.emit('updateChat',{cid:chat._id,img:fileform.current})
            }
           }/>
          </div>
            
          <div className=' flex  w-full items-baseline'>
            <input ref={chatname} onChange={(event)=>setUsername(event.target.value)} onBlur={()=>{
                    chatname.current.setAttribute('readonly', 'true');
                    socket.emit('updateChat',{cid:chatID,name:chatname.current.value})
                    
            }} style={{borderColor:chat.color}} className='  max-w-64 border-l-4  mr-1 pl-2 text-bold rounded w-fit text-start  mt-4 text-2xl outline-none' value={chatnameSt} readOnly/>
            {(chat.type=='group')?<button onClick={()=>{chatname.current.removeAttribute('readonly');chatname.current.focus()}}><img className='w-4' src={edit}></img></button>:<></>}
          </div>
          
          <div className='  w-full  mt-4 text-gray-400 items-baseline text-base '>
            <input  ref={about} onChange={(event)=>{{setAbout(event.target.value)}}} onBlur={()=>{
                    about.current.setAttribute('readonly','true');                    
                    socket.emit('updateChat',{cid:chatID,about:about.current.value})                
            }} 
            className='outline-none  pl-2 max-w-64  mr-1 rounded w-fit text-start   text-base pl-2' value={aboutSt} readOnly/>

            {(chat.type=='group')?<button onClick={()=>{about.current.removeAttribute('readonly');about.current.focus()}}><img className='w-4' src={edit}></img></button>:<></>}
          </div>
          
        {(chat.type=='group')?<div className="text-lg p-1 pl-2  w-fit pr-3 mb-4 mt-4 font-semibold border-l-2 rounded shadow-sm">Members</div>:<></>}
          <div  className=" overflow-y-scroll w-auto max-w-82">
           {members.map((data)=>{return <Entity  key={data} members={members}  setMembers={setMembers}id={data}/>})}
          </div>
        
        </div>
   </div> 

}