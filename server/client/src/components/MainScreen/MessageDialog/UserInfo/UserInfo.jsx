import React,{useRef,useMemo,useEffect, useCallback, useState} from "react";
import { useCtx } from "../../AppScreen";
import ImageInput from "../../ImageInput";
import single from '/single.svg'
import edit from '/edit.svg'
import close from '/close.svg'
export default function (props){
    const {profiles,contacts,setContacts,setMessageDialog,socket,userID}=useCtx();

    const about = useRef();
    const chatname = useRef();
    const fileform=useRef({});
    const [profile,setProfile]=useState(profiles[props.infoPanel.current||userID.current]||{})
    const [aboutSt, setAbout] = useState(profile.about || "null");
    const [chatnameSt, setName] = useState(profile.name || ""); 
    const [username, setUsername] = useState(profile.users || []);
    
  useEffect(() => {
    setAbout(profile.about || "null");
    setName(profile.name || "");
    setUsername(profile.username||'')
    }, [profiles]);

    useEffect(()=>{
         if(profiles[props.uid]){
           setProfile(profiles[props.uid])
         }
    },[profiles])

    const admin=userID.current==profile._id
    return     <div className="mt-6 rounded-xl shadow  bg-white flex-1 flex-col flex">
    <button onClick={()=>setMessageDialog(0)} className="w-fit fixed m-4 h-fit rounded-full shadow-md ">
        <img className="w-3 h-3" src={close}/>
      </button>
    <div className="bg-gray-200 pl-10 w-full h-44 ">

      <div className="relative top-20 border-1 w-fit h-fit flex rounded-full">
      
        <ImageInput
          src={profile.img ? profile.img.src : single}
          fileform={fileform}
          uneditable={!admin}
          callback={() => {
            socket.current.emit("updateChat", {
              cid: profile._id,
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
            socket.current.emit("updateChat", {
              cid: chatID,
              name: chatname.current.value,
            });
          }}
          style={{ borderColor: profile.color }}
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
            socket.current.emit("updateChat", {
              cid: chatID,
              name: chatname.current.value,
            });
          }}
          style={{ borderColor: profile.color }}
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
            socket.current.emit("updateChat", {
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
  </div>
 }