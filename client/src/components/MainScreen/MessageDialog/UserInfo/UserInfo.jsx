import React,{useRef,useMemo,useEffect, useCallback, useState} from "react";
import { useCtx } from "../../AppScreen";
import ImageInput from "../../ImageInput";
import background from '/background.jpg'
import single from '/single.svg'
import edit from '/edit.svg'
import close from '/close.svg'
export default function (props){
    const {profiles,contacts,setContacts,setMessageDialog,socket,userID}=useCtx();
    const fileform=useRef({});
    const [profile,setProfile]=useState(profiles[props.infoPanel.current||userID.current]||{})
    const [aboutSt, setAbout] = useState(profile.about || "null");
    const [useralias, setName] = useState(profile.name || ""); 
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
    <button onClick={()=>setMessageDialog(0)} className="w-fit bg-white rounded-full p-1 fixed m-4 h-fit  ">
        <img className="w-6 h-6" src={close}/>
      </button>
    <div className="bg-gray-200 rounded-t-xl pl-10 w-full h-44" style={{
          backgroundImage:`url(${background})`,
        
        }}>

      <div className="relative top-20 border-1 w-fit h-fit flex rounded-full" >
      
        <ImageInput
          src={profile.img ? profile.img.src : single}
          fileform={fileform}
          uneditable={!admin}
          callback={() => {
            socket.current.emit("updateProfile", {
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
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            console.log('name')
            socket.current.emit("updateProfile", {
              name: useralias,
            });
          }}
          style={{ borderColor: profile.color }}
          className=" word-wrap overflow-hidden text-ellipses min-w-32 border-l-4  mr-1 pl-2 text-bold rounded w-fit text-start  mt-4 text-2xl outline-none"
          value={useralias}
        
        />
      
      </div>
          <input
          onChange={(event) => setUsername(event.target.value)}
          onBlur={() => {
            socket.current.emit("updateProfile", {
              
              name:username,
            });
          }}
          style={{ borderColor: profile.color }}
          className=" overflow-hidden  text-ellipses min-w-32  text-ellipsis  mr-1 text-gray-400 text-sm rounded w-fit text-start   outline-none"
          value={`@${username}`}
          
        />

      
      <div className="  w-full  mt-4 text-gray-400 items-baseline text-base ">
        <textarea
          onChange={(event) => {
            {
              setAbout(event.target.value);
            }
          }}
          onBlur={() => {
            socket.current.emit("updateProfile", {
              about: about,
            });
          }}
          className="outline-none   max-w-md  max-h-16  mr-1 rounded w-fit resize-none overflow-scroll text-start   text-base "
          value={aboutSt}
          
        />

        
      </div>
       
      </div>
  </div>
 }