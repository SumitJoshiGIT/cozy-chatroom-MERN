import { useRef, useState, useEffect, useCallback } from "react";

import { useCtx } from "../AppScreen";
import Avatar from "../../ui/Avatar";

export default function (props) {
  const {
    chatID,
    Messages,
    socket,db,
    profiles,
    chatdata,
    chatCache,
    setChatdata,
    scrollable,
    setChatID,
    privateChats,
    setMessageDialog,
    userID,
  } = useCtx();
  
  const [chatid, setId] = useState(props.id);
  let chat = chatdata[chatid];
  const [latest, setLatest] = useState("");
  const hoverref=useRef();
  useEffect(()=>{
  if(chat.type=='private'){
    if(profiles[chat.sender]){
      const user=profiles[chat.sender];
      delete user._id;
      chat={...chat,...user}
      if(chatCache.current.chats[chat._id])
        chatCache.current.chats[chat._id]=chat;
     if(chatdata[chat._id])
      setChatdata((prev) => {
        return { ...prev, [chat._id]: chat };
      });
    }
    else socket.current.emit("getProfile", { uid: chat.sender });
  }
},[profiles[chat.sender]])

  const onClick = (event) => {
    if(window.innerWidth<600)props.setStyle(1)
    setMessageDialog(0);
    setChatID((prev) => {
      return { id: chat._id, type: chat.type };
    });
  };

  useEffect(() => {
    const curr = Object.values(Messages[chat._id] || {}).pop();
      socket.current.emit("messages", {
        cid: chat._id,
        mid: curr ? curr.mid : -1,
        gt: true,
      });
    },[])
  
  useEffect(() => {
    if (Messages[chat._id]) setLatest(Object.values(Messages[chat._id]).pop());
  }, [Messages[chat._id]]);
  
  useEffect(()=>{   
    if (chat.type == "user") {
      socket.current.on(`private.${chat._id}`, (newchat) => {
        newchat.sender = chat._id;
        props.cache.current.chats[newchat._id] = newchat;
        setChatdata((prev) => {
          const n = { ...prev };
          if (n) delete n[newchat.sender];
          n[newchat._id] = newchat;
          return n;
        });
        setId(newchat._id);
      });
    }
  }, [chatid]);

  const active = chatID.id === chat._id;
  const pad = (n) => n.toString().padStart(2, "0");
  const previewText = latest
    ? (latest.content || (latest.attachments && latest.attachments.length ? "📷 Photo" : ""))
    : "";
  const previewName = latest
    ? (latest.uid == userID.current ? "You" : (profiles[latest.uid] ? profiles[latest.uid].name : ""))
    : "";

  return (
    <div onMouseEnter={()=>{
      if(props.style==1)
          hoverref.current.style.display='block';
      }}
   onMouseLeave={()=>{
      if(props.style==1)hoverref.current.style.display='none';
    }}

    style={props.style?{'borderRadius':'100%',width:'fit-content',padding:0,height:'fit-content'}:{}}
      className={`p-2 mb-0.5 flex items-center overflow-clip min-w-30 h-fit flex-1 rounded-lg transition-colors cursor-pointer ${active ? 'bg-purple-100' : 'hover:bg-gray-100'}`}
      onClick={onClick}
    >
      <div className=" h-fit  w-fit min-w-4 flex  justify-content items-center">
        <Avatar
          src={chat.img && chat.img.src}
          kind={chat.type == "group" ? "group" : "user"}
          style={props.style?{width:'32px',height:'32px',minWidth:'10px'}:{}}
        />
          <div ref={hoverref} className="overflow-hidden hidden fixed text-ellipses text-xs font-bold left-10 bg-white p-2 rounded-md shadow w-54 ">
            {chat.name || "Unnamed"}
          </div>
      </div>

      {props.style?null
          :<div className="w-full z-20 rounded-md overflow-hidden pl-4">

        <div className="flex justify-between ">
          <div  className="overflow-hidden text-ellipses text-base w-54 font-semibold text-gray-800">
            {chat.name || "Unnamed"}
          </div>

        </div>
        <div className="text-gray-400 text-base flex">
          {latest && (
            <div className="flex  justify-between overflow-hidden w-full">
              <div className="truncate w-56 text-sm ">
                {previewName && (
                  <span
                    style={{
                      color: latest.uid == userID.current ? undefined : (profiles[latest.uid] ? profiles[latest.uid].color : undefined),
                    }}
                    className={latest.uid == userID.current ? "text-gray-400" : ""}
                  >
                    {previewName}:{" "}
                  </span>
                )}
                <span className="overflow-clip text-ellipsis text-gray-500">
                  {previewText}
                </span>
              </div>
              <span className="text-xs flex items-center ml-1 mr-1 text-gray-400 shrink-0">
                {pad(new Date(latest.updatedAt).getHours())}:
                {pad(new Date(latest.updatedAt).getMinutes())}
              </span>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
