import {useEffect, useRef, useState} from "react";
import group from '/group.svg'
import back from '/back-one.svg'
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
    const [error,setError]=useState("");
    const createTimeout = useRef(null);

    useEffect(() => () => {
      if (createTimeout.current) clearTimeout(createTimeout.current);
    }, []);

    const createGroup = () => {
         if(!chatnameSt.trim() || creating) return;
         if (!socket.current || !socket.current.connected) {
           setError("Connection unavailable. Please try again.");
           return;
         }
         setError("");
         setCreating(true);
         const onCreated = (datagroup) => {
           if (datagroup.type === 'chats') {
             socket.current.off('chatError', onError);
             if (createTimeout.current) clearTimeout(createTimeout.current);
             setCreating(false);
             setMessageDialog(0);
           }
         };
         const onError = (details) => {
           socket.current.off('chat', onCreated);
           if (createTimeout.current) clearTimeout(createTimeout.current);
           setCreating(false);
           setError(details?.message || "Unable to create the group.");
         };
         socket.current.once('chat', onCreated);
         socket.current.once('chatError', onError);
         createTimeout.current = setTimeout(() => {
           socket.current.off('chat', onCreated);
           socket.current.off('chatError', onError);
           setCreating(false);
           setError("Group creation timed out. Please try again.");
         }, 10000);
         socket.current.emit('createChat',{
           name: chatnameSt,
           members: [...members.keys()],
           file: fileform.current.file,
           type: fileform.current.type,
           imgName: fileform.current.name,
           size: fileform.current.size,
         });
    }

    return <Card className='group-create-card max-w-md w-full h-full flex flex-col overflow-hidden animate-fade-in-up'>
      <div className="relative shrink-0">
        <div className="group-create-cover flex items-center w-full h-28">
          <IconButton icon={back} alt="Back" onClick={()=>setMessageDialog(0)} className="m-3 absolute bg-white shadow-sm" />
        </div>
        <div className="group-create-identity flex flex-col items-center -mt-12">
          <ImageInput src={group} fileform={fileform} callback={()=>{}} editable={true} />
          <TextField
            className="group-create-name text-center w-64 mt-3"
            placeholder="Name your group"
            ref={chatname}
            onChange={(event)=>setUsername(event.target.value)}
            value={chatnameSt}
            required
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 px-4 pt-4 flex flex-col">
        <div className="group-create-heading shrink-0">
          <span className="text-xs font-semibold uppercase tracking-wide">People</span>
          <span className="text-xs text-[var(--text-muted)]">Choose who should be here</span>
        </div>
        <Friends members={members} setMembers={setMembers}/>
      </div>

      <div className="group-create-footer shrink-0 flex items-center justify-between px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-[var(--text)]">{members.size} selected</div>
          {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
        </div>
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
