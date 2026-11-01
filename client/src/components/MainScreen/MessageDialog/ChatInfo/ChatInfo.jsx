import single from "/single.svg";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useCtx } from "../../AppScreen.jsx";
import ImageInput from "../../ImageInput.jsx";
import Card from "../../../ui/Card.jsx";
import IconButton from "../../../ui/IconButton.jsx";
import Button from "../../../ui/Button.jsx";
import { TextField, TextArea } from "../../../ui/TextField.jsx";
import { useToast } from "../../../ui/Toast.jsx";
import { downloadFile } from "../../../../download";
import Members from "./Members.jsx";
import Media from './Media.jsx'
import Permissions from "./Permissions.jsx";
import close from '/close.svg'
const Tabs={
  1:Members,
  0:Media,
  2:Permissions,
}
export default function (props) {
  const { chatdata, privateChats,socket,setMessageDialog, chatID, profiles, userID, blocked, toggleBlock, report } = useCtx();
  let chat = chatdata[chatID.id] || {};
  const toast = useToast();
  const [aboutSt, setAbout] = useState(chat.about || "");
  const [chatnameSt, setName] = useState(chat.name || "");
  const [username, setUsername] = useState(chat.username || '');
  const [active,setActive]=useState(0);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const isBlocked = chat.type !== 'group' && chat.sender && blocked.has(chat.sender);
  useEffect(() => {
    setAbout(chat.about || "");
    setName(chat.name || "");
    setUsername(chat.username || '');
  }, [chat.about, chat.name, chat.username]);

  useEffect(() => {
    setActive(0);
    setReporting(false);
  }, [chatID.id]);
  const isOwner = userID.current == chat.owner;
  const admin =
    (chat.admins || []).includes(userID.current) || isOwner;
  const fileform = useRef({});
  const [inviteLink, setInviteLink] = useState("");
  useEffect(() => {
    setInviteLink("");
    const onInvite = ({ cid, code }) => {
      if (cid === chat._id) setInviteLink(`${window.location.origin}/app?invite=${code}`);
    };
    const socketRef = socket.current;
    socketRef.on("inviteCode", onInvite);
    return () => socketRef.off("inviteCode", onInvite);
  }, [chat._id]);
  const ActiveTab=Tabs[active];

  return (
    <Card className="profile-card mt-0 max-w-xl flex-1 h-full flex-col flex">
      <IconButton icon={close} alt="Close" onClick={()=>setMessageDialog(0)} className="profile-close w-fit absolute top-4 right-4 h-fit" />
      <div className="profile-cover rounded-t-xl shadow-sm pl-8 w-full h-44 ">

        <div className="profile-avatar relative top-16 w-fit h-fit flex rounded-full">
          <ImageInput
            src={chat.img ? chat.img.src : single}
            fileform={fileform}
            uneditable={!admin}
            callback={() => {
              socket.current.emit("updateChat", {
                cid: chat._id,
                img: {
                  type: fileform.current.type,
                  name: fileform.current.name,
                  size: fileform.current.size,
                },
                file: fileform.current.file,
              });
            }}
          />
        </div>
      </div>
      <div className="profile-details h-fit pb-6 mt-6 flex p-6 flex-col gap-3">
        <TextField
          disabled={!admin}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            socket.current.emit("updateChat", {
              cid: chatID.id,
              name: chatnameSt,
            });
          }}
          accentColor={chat.color}
          inputClassName="profile-name text-2xl font-bold w-fit"
          value={chatnameSt}
        />

        <TextField
          disabled={!admin}
          onChange={(event) => setUsername(event.target.value.replace(/^@/, ''))}
          onBlur={() => {
            socket.current.emit("updateChat", {
              cid: chatID.id,
              username: username,
            });
          }}
          inputClassName="profile-username text-sm w-fit"
          value={`@${username}`}
        />

        <TextArea
          disabled={!admin}
          onChange={(event) => setAbout(event.target.value)}
          onBlur={() => {
            socket.current.emit("updateChat", {
              cid: chatID.id,
              about: aboutSt,
            });
          }}
          className="profile-about mt-2 max-w-md h-20 w-full"
          value={aboutSt}
          placeholder="Add a short description…"
        />

        <div className="flex flex-wrap gap-2 mt-1">
          {chat.type !== 'group' && chat.sender && (
            <Button variant={isBlocked ? "ghost" : "danger"} onClick={() => toggleBlock(chat.sender)}>
              {isBlocked ? "Unblock" : "Block"}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setReporting((v) => !v)}>
            Report
          </Button>
          {chat.img && (
            <Button
              variant="ghost"
              onClick={() =>
                downloadFile(chat.img.src, chat.img.name || `${chat.username || chat.name || "chat"}.jpg`).catch(
                  () => toast.error("Couldn't download photo")
                )
              }
            >
              Download photo
            </Button>
          )}
        </div>
        {admin && chat.type === "group" && (
          <div className="invite-panel flex flex-col gap-2 max-w-md mt-1">
            {inviteLink ? (
              <>
                <input readOnly aria-label="Invite link" value={inviteLink} onFocus={(event) => event.target.select()} className="invite-link" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => navigator.clipboard.writeText(inviteLink).then(() => toast.success("Invite link copied."), () => toast.error("Couldn't copy the link"))}>Copy link</Button>
                  <Button variant="ghost" onClick={() => socket.current.emit("resetInviteCode", { cid: chat._id })}>Reset link</Button>
                </div>
                <p className="text-xs text-[var(--text-muted)]">Anyone with this link can join. Resetting it stops the old link working.</p>
              </>
            ) : (
              <Button variant="ghost" className="self-start" onClick={() => socket.current.emit("getInviteCode", { cid: chat._id })}>Get invite link</Button>
            )}
          </div>
        )}
        {reporting && (
          <div className="flex flex-col gap-2 max-w-md mt-1">
            <TextArea
              className="h-16 w-full"
              placeholder={`Why are you reporting this ${chat.type === 'group' ? 'group' : 'chat'}? (optional)`}
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
            />
            <Button
              variant="danger"
              className="self-start"
              disabled={reportSent}
              onClick={() => {
                report(chatID.id, "chat", reportReason);
                setReportSent(true);
                setTimeout(() => { setReporting(false); setReportSent(false); setReportReason(""); }, 800);
              }}
            >
              {reportSent ? "Reported" : "Submit report"}
            </Button>
          </div>
        )}
       </div>
       <div>
            <div className="items-center flex w-full border-b text-gray-500 text-sm font-semibold">
              {chat.type == "group"&&<button className={`flex-1 p-2 pb-2.5 transition-colors ${active===1?'text-purple-600 border-b-2 border-purple-400':'hover:text-gray-600'}`} onClick={()=>setActive(1)}>Members</button>}
              <button className={`flex-1 p-2 pb-2.5 transition-colors ${active===0?'text-purple-600 border-b-2 border-purple-400':'hover:text-gray-600'}`} onClick={()=>setActive(0)}>Media</button>
              {admin&&<button className={`flex-1 p-2 pb-2.5 transition-colors ${active===2?'text-purple-600 border-b-2 border-purple-400':'hover:text-gray-600'}`} onClick={()=>setActive(2)}>Permissions</button>}
            </div>
       {chat&&ActiveTab&&<ActiveTab chat={chat} admin={admin} owner={isOwner}/>}

      </div>
    </Card>
  );
}
