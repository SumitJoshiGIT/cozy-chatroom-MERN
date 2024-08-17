import single from '/single.svg';
import { useRef ,useEffect,useState,useCallback} from 'react';
import { useCtx } from '../../AppScreen';
import edit from '/edit.svg';
import socket from '../../../Socket';
import ImageInput from '../../ImageInput.jsx';
export default function (){
   const {userID,profiles}=useCtx();
   const about=useRef();
   const username=useRef();
   const fileform=useRef({});
   const [profile,setProfile]=useState(profiles[userID.current]||{})
   const [aboutSt,setAbout]=useState(profile.about||"null");
   const [usernameSt,setUsername]=useState(profile.name);
   useEffect(()=>{
        if(profiles[userID.current]){
          setProfile(profiles[userID.current])
        }
   },[profiles])
   return <div className='mt-6'>
        <div className='min-h-64 p-4 flex border-b  flex-col'>
          <ImageInput src={profile.img?(`/${profile.img.src}`):single} fileform={fileform} callback={()=>{
            socket.emit('updateProfile',{img:fileform.current})
          }}/> 
          
          <div className=' flex  w-full items-baseline'>
            <input ref={username} onChange={(event)=>setUsername(event.target.value)} onBlur={()=>{
                    username.current.setAttribute('readonly', 'true');
                    socket.emit('updateProfile',{uid:userID.current,name:username.current.value})
                    
            }} style={{borderColor:profile.color}} className='  max-w-64 border-l-4  mr-1 pl-2 text-bold rounded w-fit text-start  mt-4 text-2xl outline-none' value={usernameSt} readOnly/>
            <button onClick={()=>{username.current.removeAttribute('readonly');username.current.focus()}}><img className='w-4' src={edit}></img></button>
          </div>
          
          <div className='  w-full  mt-4 text-gray-400 items-baseline text-base '>
            <input  ref={about} onChange={(event)=>{{setAbout(event.target.value)}}} onBlur={()=>{
                    about.current.setAttribute('readonly','true');                    
                    socket.emit('updateProfile',{uid:userID.current,about:about.current.value})                
            }} 
            className='outline-none  pl-2 max-w-64  mr-1 rounded w-fit text-start   text-base pl-2' value={aboutSt} readOnly/>

            <button onClick={()=>{about.current.removeAttribute('readonly');about.current.focus()}}><img className='w-4' src={edit}></img></button>
          </div>
          <button className='text-sm border border-gray-300  mt-4 p-2 rounded w-fit' onClick={()=>{socket.emit('logout')}}>Logout</button>    
        </div>
      
   </div> 

}