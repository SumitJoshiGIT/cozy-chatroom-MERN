import { useState,useEffect,useRef,useMemo } from "react";
import { useCtx } from "../../AppScreen";
import Avatar from "../../../ui/Avatar";
import IconButton from "../../../ui/IconButton";
import Button from "../../../ui/Button";
import options from '/options.svg'
import bell from '/bell.svg'
import report from '/report.svg'
import leave from '/leave.svg'


export default function (props){
    
    const {chatID,db,chatdata,socket,profiles,userID}=useCtx()
    let chat=(chatdata)&&chatdata[chatID.id]||{};
    const [user,setUser]=useState(null);
    const option=useRef();

    useEffect(()=>{
      setUser(profiles[userID.current]);

    },[chat,profiles])

    const otherProfile = chat.type !== 'group' ? profiles[chat.sender] : null;
    const memberCount = chat.users && chat.users.length;
    const status = chat.type === 'group'
      ? `${memberCount || 0} member${memberCount === 1 ? '' : 's'}`
      : (otherProfile && otherProfile.username ? `@${otherProfile.username}` : 'Direct message');
    
    const leaveChat=()=>{ 
      console.log("emit")
      try{
        socket.current.emit('leaveChat',{id:chatID.id,del:true});
        option.current.classList.toggle('hidden');
      }
    catch(e){console.log(e)}  
    }
    
    //socket.current.emit('reportChat',chatID.id);
    const reportChat=()=>{
     socket.current.emit('reportChat',chatID.id);
    }
    const muteChat=()=>{
      socket.current.emit('muteChat',chatID.id);
    }
    useEffect(()=>{
        if(option.current){
          option.current.classList.add('hidden');
            
        }
    },[chatID])
   return( 
      <div className="w-full  rounded-t-xl ">
      <div className="  w-full shadow-sm  border-b  p-2   pl-4 justify-between items-center  h-14 bg-white flex">
          
        <div className="flex"> 
         <button onClick={()=>{
          props.setDialog(1);}} className="outline-none  border-none rounded-full h-fit w-fit">
           <Avatar src={chat.img && chat.img.src} kind={chat.type=='group'?'group':'user'} size="sm" />
         </button>
        <div className="p-2 pt-1 flex flex-col ">
         <div className="text-sm w-36 text-ellipses font-semibold">{chat.name||"Unnamed"}</div>
         <div className="text-xs text-gray-400">{status}
         </div>
        </div>
        </div>
        <div className="flex items-center">
        {(user&&(chatID.type!='user'&&(!user.Chats.includes(chatID.id))))&&<Button variant="secondary" className="mr-2 w-24" onClick={()=>{socket.current.emit("join",[chatID.id])}}>Join</Button>}
   
        <IconButton icon={options} alt="Options" onClick={()=>{
            if(option.current){
              option.current.classList.toggle('hidden')
            }
          }} />

        </div>
    </div>
   
    <div ref={option} onClick={((event)=>{
          option.current.classList.toggle('hidden');
          option.current.removeEventListener('mouseLeave',(event)=>{
          option.current.classList.toggle('hidden');
        })})}
         onMouseLeave={(event)=>{
          option.current.classList.toggle('hidden');
         }}
         className=" p-1 w-40 mt-4 ring-red-100 opacity-95 h-fit z-10 bg-white rounded-lg justify-start flex-col shadow-lg fixed right-12 py-2 hidden text-sm text-gray-600">
              <button onClick={muteChat} className="rounded-lg px-2 py-1.5 flex items-center gap-2 w-full hover:bg-gray-100">
              <img src={bell}  className="w-4 h-4"></img><div>Mute</div></button>
              <button onClick={reportChat}  className="rounded-lg px-2 py-1.5 flex items-center gap-2 w-full hover:bg-gray-100">
              <img src={report}  className="w-4 h-4"></img><div>Report</div></button>
              <button onClick={leaveChat} className="rounded-lg px-2 py-1.5 flex items-center gap-2 w-full hover:bg-gray-100">
              <img src={leave}  className="w-4 h-4"></img><div>{(chat.type=='group')?'Leave':'Remove'}</div></button>

    </div>
   </div>  
  );
}