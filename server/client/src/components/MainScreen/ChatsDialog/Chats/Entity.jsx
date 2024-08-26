import { useRef, useState, useEffect, useCallback } from "react";

import { useCtx } from "../../AppScreen";
import single from "/single.svg";
import group from "/group.svg";

export default function (props) {
  const {
    chatID,
    Messages,
    socket,
    profiles,
    chatdata,
    setChatdata,
    scrollable,
    setChatID,
    privateChats,
    setMessageDialog,
  } = useCtx();
  const [chatid, setId] = useState(props.id);
  let chat = chatdata[chatid];
  const [latest, setLatest] = useState("");
  const hoverref=useRef();
  useEffect(() => {
    if (chat.type != "group") {
      const profile = profiles[chat.sender];
      if (chatID.id == chat.sender)
        setChatID({ id: chat._id, type: "private" });

      if (profile) {
        delete profile["_id"];
        console.log(profiles[chat.sender]);
        setChatdata((prev) => {
          const data = { ...prev };
          data[chat._id] = { ...chat, ...profile };
          return data;
        });
      } else socket.current.emit("getProfile", { uid: chat.sender });
    }
  }, [profiles]);

  const onClick = (event) => {
    setMessageDialog(0);
    setChatID((prev) => {
      return { id: chat._id, type: chat.type };
    });
  };

  useEffect(() => {
    if (Messages[chat._id]) setLatest(Object.values(Messages[chat._id]).pop());
  }, [Messages[chat._id]]);

  useEffect(() => {
    if (chat.type != "user") {
      const curr = Object.values(Messages[chat._id] || {}).pop();
      socket.current.emit("messages", {
        cid: chat._id,
        mid: curr ? curr.mid : -1,
        gt: true,
      });
    } else {
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

  return (
    <div onMouseEnter={()=>{
      if(props.style==1)
          hoverref.current.style.display='block';
      }}
   onMouseLeave={()=>{
      if(props.style==1)hoverref.current.style.display='none';
    }}
      style={props.style?{'border-radius':'100%',width:'fit-content',padding:0,height:'fit-content'}:{}}
      className="p-2 m-1 mb-2 shadow-md  flex  overflow-hidden hover:bg-gray-100 h-fit w-full bg-white  rounded-md"
      onClick={onClick}
    >
      <div className=" h-fit w-fit min-w-4 flex  justify-content items-center">
        <img 
          className=" min-w-12 w-12 h-12 border  rounded-full bg-white"
          src={
            (chat.img && chat.img.src) || chat.type != "group" ? single : group
          }
          style={props.style?{width:'32px',height:'32px',minWidth:'10px'}:{}}
        ></img>
          <div ref={hoverref} className="overflow-hidden hidden fixed text-ellipses text-xs font-bold left-10 bg-white p-2 rounded-md shadow w-54 ">
            {chat.name || "Unnamed"}
          </div>
      </div>

      {props.style?null
          :<div className="w-full rounded-md overflow-hidden pl-4">
        
        <div className="flex justify-between ">
          <div  className="overflow-hidden text-ellipses text-lg w-54 font-semibold">
            {chat.name || "Unnamed"}
          </div>

        </div>
        <div className="text-gray-400 text-base flex">
          {latest && (
            <div className="flex  justify-between overflow-hidden w-full">
              <div className="truncate w-56 text-sm ">
                <span
                  style={{
                    color: profiles[latest.uid]
                      ? profiles[latest.uid].color
                      : "",
                  }}
                >
                  {profiles[latest.uid] ? profiles[latest.uid].name : " "}:
                </span>
                <span className="overflow-clip text-ellipsis ">
                  {latest.content}
                </span>
              </div>
              <span className="text-xs flex items-center ml-1 mr-1">
                {new Date(latest.updatedAt).getHours()}:
                {new Date(latest.updatedAt).getMinutes()}
              </span>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
