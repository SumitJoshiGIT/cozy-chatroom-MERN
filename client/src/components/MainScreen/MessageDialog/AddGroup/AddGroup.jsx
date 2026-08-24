import {useRef, useState} from "react";
import group from '/group.svg'
import back from '/back-one.svg'
import background from '/background.jpg'
import Friends from "./Friends";
import ImageInput from "../../ImageInput";
import { useCtx } from "../../AppScreen";
import Card from "../../../ui/Card";
import IconButton from "../../../ui/IconButton";
import Button from "../../../ui/Button";
import { TextField } from "../../../ui/TextField";
import Spinner from "../../../ui/Spinner";
import send from "/send.svg";

export default function (props){
    const {socket,setMessageDialog}=useCtx();
    const chatname=useRef('');
    const fileform=useRef({});
    const [chatnameSt,setUsername]=useState('');
    const [members,setMembers]=useState(new Set());
    const [creating,setCreating]=useState(false);

    const createGroup = () => {
         if(!chatnameSt.trim()) return;
         setCreating(true);
         socket.current.once('chat', (datagroup) => {
           if (datagroup.type === 'chats') {
             setCreating(false);
             setMessageDialog(0);
           }
         });
         socket.current.emit('createChat',{
           name: chatnameSt,
           members: [...members.keys()],
           file: fileform.current.file,
           type: fileform.current.type,
           imgName: fileform.current.name,
           size: fileform.current.size,
         });
    }

    return <Card className='max-w-md w-full h-full flex flex-col overflow-hidden animate-fade-in-up'>
      <div className="relative shrink-0">
        <div style={{ backgroundImage:`url(${background})` }} className="bg-gray-200 flex items-center w-full h-28">
          <IconButton icon={back} alt="Back" onClick={()=>setMessageDialog(0)} className="m-3 absolute bg-white shadow-sm" />
        </div>
        <div className="flex flex-col items-center -mt-12">
          <ImageInput src={group} fileform={fileform} callback={()=>{}} editable={true} />
          <TextField
            className="text-center w-48 mt-3"
            placeholder="Group name"
            ref={chatname}
            onChange={(event)=>setUsername(event.target.value)}
            value={chatnameSt}
            required
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 px-4 pt-4 flex flex-col">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 shrink-0">Add members</div>
        <Friends members={members} setMembers={setMembers}/>
      </div>

      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <div className="text-sm text-gray-500">{members.size} member{members.size===1?'':'s'} selected</div>
        <Button
          onClick={createGroup}
          disabled={!chatnameSt.trim() || creating}
          className="gap-2"
        >
          {creating ? (
            <Spinner size="xs" color="white" />
          ) : (
            <>Create <img src={send} className="w-3.5 h-3.5 invert" alt="" /></>
          )}
        </Button>
      </div>
    </Card>
}
