import single from "/single.svg";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useCtx } from "../../AppScreen.jsx";
import edit from "/edit.svg";
import socket from "../../../Socket.js";
import ImageInput from "../../ImageInput.jsx";
import Entity from "./Entity.jsx";
export default function () {
  const { chatdata, privateChats, chatID, profiles, userID } = useCtx();
  const about = useRef();
  const chatname = useRef();
  
  let chat = chatdata[chatID.current.id] || {};
  const [aboutSt, setAbout] = useState(chat.about || "null");
  const [chatnameSt, setName] = useState(chat.name || "");
  const [members, setMembers] = useState(chat.users || []);
  const [username, setUsername] = useState(chat.users || []);
  const [active,setActive]=useState(0);
  useEffect(() => {
    setAbout(chat.about || "null");
    setName(chat.name || "");
    setMembers(chat.users || "");
    setUsername(chat.username || '');  
  }, [chat]);
  const admin =
    userID.current in (chat.admins || []) || userID.current == chat.owner;
  const fileform = useRef({});

  return (
    <div className="mt-6 rounded-xl shadow  bg-white flex-1 flex-col flex">
      <div className="bg-gray-200 pl-10 w-full h-44 ">
        <div className="relative top-20 border-1 w-fit h-fit flex rounded-full">
          <ImageInput
            src={chat.img ? chat.img.src : single}
            fileform={fileform}
            uneditable={!admin}
            callback={() => {
              socket.emit("updateChat", {
                cid: chat._id,
                img: fileform.current,
              });
            }}
          />
        </div>
      </div>
      <div className="min-h-64 mt-8 flex  p-4 flex-col">
        <div className=" flex font-bold w-full items-baseline">
          <input
            ref={chatname}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              chatname.current.setAttribute("readonly", "true");
              socket.emit("updateChat", {
                cid: chatID,
                name: chatname.current.value,
              });
            }}
            style={{ borderColor: chat.color }}
            className=" word-wrap overflow-hidden text-ellipses min-w-32 border-l-4  mr-1 pl-2 text-bold rounded w-fit text-start  mt-4 text-2xl outline-none"
            value={chatnameSt}
            readOnly
          />
          {admin ? (
            <button
              onClick={() => {
                chatname.current.removeAttribute("readonly");
                chatname.current.focus();
              }}
            >
              <img className="w-4" src={edit}></img>
            </button>
          ) : (
            <></>
          )}
        </div>
            <input
            ref={chatname}
            onChange={(event) => setUsername(event.target.value)}
            onBlur={() => {
              chatname.current.setAttribute("readonly", "true");
              socket.emit("updateChat", {
                cid: chatID,
                name: chatname.current.value,
              });
            }}
            style={{ borderColor: chat.color }}
            className=" overflow-hidden text-ellipses min-w-32   mr-1 text-gray-400 text-sm rounded w-fit text-start   outline-none"
            value={`@${username}`}
            readOnly
          />

        
        <div className="  w-full  mt-4 text-gray-400 items-baseline text-base ">
          <textarea
            ref={about}
            onChange={(event) => {
              {
                setAbout(event.target.value);
              }
            }}
            onBlur={() => {
              about.current.setAttribute("readonly", "true");
              socket.emit("updateChat", {
                cid: chatID,
                about: about.current.value,
              });
            }}
            className="outline-none   max-w-md  max-h-16  mr-1 rounded w-fit resize-none overflow-scroll text-start   text-base "
            value={aboutSt}
            readOnly
          />

          {admin ? (
            <button
              onClick={() => {
                about.current.removeAttribute("readonly");
                about.current.focus();
              }}
            >
              <img className="w-4" src={edit}></img>
            </button>
          ) : (
            <></>
          )}
        </div>
       </div>
       <div>  
        {chat.type != "group" ? (
          <div>
            <div className=" items-center flex w-full shadow-md text-gray-500">
              <button className="flex-1  p-2 max-w-32 outline-none    font-semibold pb-1 pt-1 rounded-none  ">Members</button>
              <button className="flex-1 p-2 max-w-32 outline-none   font-semibold pt-1 pb-1 rounded-none ">Media</button>
              <button className=" max-w-32 flex-1  outline-none   font-semibold rounded-none p-2 pt-1 pb-1">Permissions</button> 
            </div>
            <div className=" overflow-y-scroll w-auto max-w-82">
              {new Array(...members).map((data) => {
                return (
                  <Entity
                    key={data}
                    members={members}
                    admin={admin}
                    setMembers={setMembers}
                    id={data}
                    chat={chat}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
