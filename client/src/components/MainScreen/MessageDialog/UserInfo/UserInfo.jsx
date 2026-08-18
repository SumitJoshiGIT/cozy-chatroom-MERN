import React,{useRef,useMemo,useEffect, useCallback, useState} from "react";
import { useNavigate } from "react-router-dom";
import { useCtx } from "../../AppScreen";
import ImageInput from "../../ImageInput";
import { post } from "../../../Axios";
import Card from "../../../ui/Card";
import IconButton from "../../../ui/IconButton";
import Button from "../../../ui/Button";
import { TextField, TextArea } from "../../../ui/TextField";
import { useToast } from "../../../ui/Toast";
import { downloadFile } from "../../../../download";
import background from '/background.jpg'
import single from '/single.svg'
import close from '/close.svg'
export default function (props){
    const {profiles,contacts,setContacts,setMessageDialog,socket,userID,setChatID,privateChats,blocked,toggleBlock,report}=useCtx();
    const toast=useToast();
    const navigate=useNavigate();
    const fileform=useRef({});
    const currentId=props.infoPanel.current||userID.current;
    const profile=profiles[currentId]||{};
    const [aboutSt, setAbout] = useState(profile.about || "");
    const [useralias, setName] = useState(profile.name || "");
    const [username, setUsername] = useState(profile.username || '');
    const [reporting, setReporting] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportSent, setReportSent] = useState(false);
    const isBlocked = blocked && blocked.has(currentId);

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

      {!admin && (
        <div className="mt-4 flex flex-col gap-2 self-start">
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => {
                const existingId = privateChats.current && privateChats.current[currentId];
                setChatID({ id: existingId || currentId, type: existingId ? 'private' : 'user' });
                setMessageDialog(0);
              }}>
              Message
            </Button>
            <Button variant={isBlocked ? "ghost" : "danger"} onClick={() => toggleBlock(currentId)}>
              {isBlocked ? "Unblock" : "Block"}
            </Button>
            <Button variant="ghost" onClick={() => setReporting((v) => !v)}>
              Report
            </Button>
            {profile.img && (
              <Button
                variant="ghost"
                onClick={() =>
                  downloadFile(profile.img.src, profile.img.name || `${profile.username || "profile"}.jpg`).catch(
                    () => toast.error("Couldn't download photo")
                  )
                }
              >
                Download photo
              </Button>
            )}
          </div>
          {reporting && (
            <div className="flex flex-col gap-2 max-w-md">
              <TextArea
                className="h-16 w-full"
                placeholder="Why are you reporting this user? (optional)"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
              />
              <Button
                variant="danger"
                className="self-start"
                disabled={reportSent}
                onClick={() => {
                  report(currentId, "user", reportReason);
                  setReportSent(true);
                  setTimeout(() => { setReporting(false); setReportSent(false); setReportReason(""); }, 800);
                }}
              >
                {reportSent ? "Reported" : "Submit report"}
              </Button>
            </div>
          )}
        </div>
      )}
      </div>
  </Card>
 }
