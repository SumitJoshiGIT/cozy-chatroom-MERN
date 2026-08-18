import React,{useRef,useMemo,useEffect, useCallback, useState} from "react";
import { useNavigate } from "react-router-dom";
import { useCtx } from "../../AppScreen";
import ImageInput from "../../ImageInput";
import { post } from "../../../Axios";
import Card from "../../../ui/Card";
import IconButton from "../../../ui/IconButton";
import Button from "../../../ui/Button";
import { TextField, TextArea } from "../../../ui/TextField";
import background from '/background.jpg'
import single from '/single.svg'
import close from '/close.svg'
export default function (props){
    const {profiles,contacts,setContacts,setMessageDialog,socket,userID}=useCtx();
    const navigate=useNavigate();
    const fileform=useRef({});
    const currentId=props.infoPanel.current||userID.current;
    const profile=profiles[currentId]||{};
    const [aboutSt, setAbout] = useState(profile.about || "");
    const [useralias, setName] = useState(profile.name || "");
    const [username, setUsername] = useState(profile.username || '');

  useEffect(() => {
    setAbout(profile.about || "");
    setName(profile.name || "");
    setUsername(profile.username||'')
    }, [profile]);

    const admin=userID.current==profile._id
    return     <Card className="mt-6 flex-1 flex-col flex">
    <IconButton icon={close} alt="Close" onClick={()=>setMessageDialog(0)} className="w-fit bg-white fixed m-4 h-fit shadow-sm" />
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
              img: {
                type: fileform.current.type,
                name: fileform.current.name,
                size: fileform.current.size,
                dimensions: fileform.current.dimensions,
              },
              file: fileform.current.file,
            });
          }}
        />
      </div>
    </div>
    <div className="min-h-64 mt-8 flex p-4 flex-col gap-2">
      <TextField
        disabled={!admin}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => {
          socket.current.emit("updateProfile", {
            name: useralias,
          });
        }}
        accentColor={profile.color}
        inputClassName="text-2xl font-bold w-fit"
        value={useralias}
        placeholder="Your name"
      />

      <TextField
        disabled={!admin}
        onChange={(event) => setUsername(event.target.value.replace(/^@/, ''))}
        onBlur={() => {
          socket.current.emit("updateProfile", {
            username:username,
          });
        }}
        inputClassName="text-gray-400 text-sm w-fit"
        value={`@${username}`}
      />

      <TextArea
        disabled={!admin}
        onChange={(event) => setAbout(event.target.value)}
        onBlur={() => {
          socket.current.emit("updateProfile", {
            about: aboutSt,
          });
        }}
        className="mt-2 max-w-md h-20 w-full"
        value={aboutSt}
        placeholder="About"
      />

      {admin && (
        <Button variant="danger" className="mt-4 self-start" onClick={async () => {
            await post('/auth/logout');
            socket.current.disconnect();
            navigate('/auth/signin');
          }}>
          Log out
        </Button>
      )}
      </div>
  </Card>
 }
