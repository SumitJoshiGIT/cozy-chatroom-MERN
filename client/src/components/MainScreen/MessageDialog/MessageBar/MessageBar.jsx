import React, { useMemo } from "react";
import { useState, useRef, useEffect } from "react";
import { useCtx } from "../../AppScreen";
import IconButton from "../../../ui/IconButton";
import { useToast } from "../../../ui/Toast";
import attachment from "/attachment.svg";
import send from "/send.svg";
import reply from "/reply.svg";
import edit from "/edit.svg";
import close from "/close.svg";
import fileIcon from "/files.svg";
const maxSize = 2*1024*1024;
const imageTypes = ['image/jpeg','image/png','image/jpg','image/webp','image/svg','image/svg+xml'];
const docTypes = [
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv','application/zip',
];
const acceptedTypes = [...imageTypes, ...docTypes];
const MessageBar = React.memo((props) => {
  const { setMessages, db, scrollable, profiles, userID, chatID, socket, emitTyping, chatdata, blocked, toggleBlock }=useCtx();
  const toast=useToast();
  const chat = chatdata[chatID.id] || {};
  const blockedOther = chat.type !== 'group' && chat.sender && blocked.has(chat.sender);

  const [message, setMessage] = useState("");
  const ref = useRef(null);
  const lastTypingEmit = useRef(0);
  let [user, setUser] = useState(profiles[userID.current]);
  useEffect(() => {
    setUser(profiles[userID.current]);
  }, [profiles]);
  const filesRef = useRef(null);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (props.edit) setMessage(props.edit[0].content || "");
  }, [props.edit]);

  function saveEdit(event) {
    event.preventDefault();
    if (!message.trim()) return;
    const target = props.edit[0];
    socket.current.emit("editMessage", {
      id: target._id,
      cid: chatID.id,
      content: message,
    });
    setMessage("");
    props.setEdit();
  }

  async function SendMessage(event) {
    event.preventDefault();
    if (props.edit) return saveEdit(event);
    if (!message.trim() && files.length === 0) return;
    const id = new Date().toUTCString();
    const r2 = props.reply ? props.reply[0]._id : null;
    let msg = {
      _id: id,
      uid: userID.current,
      content: message,
      mid: id,
      chat: chatID.id,
      time: new Date(),
      reply_to: r2,
      updatedAt: new Date(),
      status: "⧖",
      attachments: files,
    };
    if (db)
      db.transaction("messages", "readwrite").objectStore("messages").put(msg);
    setMessages((prev) => {
      const obj = { ...prev };
      obj[chatID.id] = { ...(obj[chatID.id] || {}), ...{ [msg._id]: msg } };
      return obj;
    });
    
    setMessage("");
    setFiles([]);

    if (props.reply) props.setReply();
    scrollable.current.scrollTo(0, scrollable.current.scrollHeight);
  }
  useEffect(() => {
    if (ref.current) ref.current.style.height = "auto";
  }, [message]);
  
  const replyTo = useMemo(() => {
    if (props.reply) {
      console.log(props.reply);
      const m = props.reply[0];
      const p = props.reply[1];

      return (
        <div
          style={{ borderLeft: p.color || "red" }}
          className="flex items-center w-full bg-white dark:bg-gray-800 border-l-2 rounded-t-lg rounded-md  mb-2 opacity-85 p-1"
        >
          <img src={reply} className="w-7 h-7 mr-2"></img>
          <div className="flex-1 rounded-md pl-2 bg-opacity-20" style={{}}>
            <div style={{ color: p.color }} className="text-xs font-bold ">
              {p.name}
            </div>
            <div className="h-auto text-sm ">{m.content}</div>
          </div>
        </div>
      );
    } else return null;
  }, [props.reply]);

  const editBanner = useMemo(() => {
    if (!props.edit) return null;
    return (
      <div className="flex items-center w-full bg-white dark:bg-gray-800 border-l-2 border-[var(--accent)] rounded-t-lg rounded-md mb-2 opacity-85 p-1">
        <img src={edit} className="w-5 h-5 mx-2 dark:invert dark:opacity-80"></img>
        <div className="flex-1 rounded-md pl-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
          Editing message
        </div>
        <button type="button" onClick={() => { props.setEdit(); setMessage(""); }} className="p-1">
          <img src={close} className="w-4 h-4 dark:invert dark:opacity-80" />
        </button>
      </div>
    );
  }, [props.edit]);
  function handleChange(event) {
           const selected = Array.from(filesRef.current.files || []);
           selected.forEach((file) => {
              if (!acceptedTypes.includes(file.type)) {
                toast.error(`${file.name}: unsupported file type`);
                return;
              }
              if (file.size > maxSize) {
                toast.error(`${file.name}: file too large (max 2MB)`);
                return;
              }
              const reader = new FileReader();
              reader.onloadend = () => {
                const data = reader.result.split(',')[1];
                setFiles((prev) => [...prev, { file: data, name: file.name, type: file.type, size: file.size }]);
              };
              reader.readAsDataURL(file);
           });
           filesRef.current.value = '';
          }
  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }


  const canSend = message.trim() || files.length > 0;
  return (
    <div className="flex flex-col justify-center items-center px-4 pb-4 pt-1 w-full max-w-xl mx-auto">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 w-full mb-2">
          {files.map((file,idx)=>(
            <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {file.type.startsWith('image/') ? (
                <img src={`data:${file.type};base64,${file.file}`} alt={file.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                  <img src={fileIcon} className="w-6 h-6 opacity-60 dark:invert" alt="" />
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 truncate w-full text-center px-1">{file.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={()=>removeFile(idx)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center"
              >×</button>
            </div>
          ))}
        </div>
      )}
      {editBanner}
      {!props.edit && replyTo}
      {blockedOther ? (
        <div className="p-3 rounded-3xl shadow-md bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 w-full flex items-center justify-between gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">You've blocked this contact — messages won't be delivered.</span>
          <button
            type="button"
            onClick={() => toggleBlock(chat.sender)}
            className="text-sm font-semibold text-[var(--accent-dark)] shrink-0"
          >Unblock</button>
        </div>
      ) : user &&(chatID.type=='user'||user.Chats.includes(chatID.id))? (
        <div className="p-1.5 rounded-3xl shadow-md bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 w-full flex items-end gap-1">
          <input
            ref={filesRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            onChange={handleChange}
            multiple
            className="hidden"
          />
          <IconButton icon={attachment} alt="Attach file" size="lg" onClick={() => filesRef.current.click()} />
          <textarea
            rows="1"
            onKeyDown={(event) => {
              if (event.key == "Enter" && !event.shiftKey) {
                event.preventDefault();
                SendMessage(event);
                ref.current.style.height = "auto";
              }
            }}
            ref={ref}
            onInput={function () {
              ref.current.style.height = "auto";

              ref.current.style.height = ref.current.scrollHeight + "px";
            }}
            className="pt-2 pb-1.5 align-bottom bg-transparent text-sm max-h-36 w-full outline-none border-none min-h-9 h-auto text-gray-700 dark:text-gray-100 resize-none placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Write your message..."
            type="text"
            onChange={(event) => {
              setMessage(() => event.target.value);
              if (!props.edit) {
                const now = Date.now();
                if (now - lastTypingEmit.current > 2000) {
                  lastTypingEmit.current = now;
                  emitTyping(chatID.id);
                }
              }
            }}
            value={message}
          ></textarea>
          <IconButton
            icon={send}
            alt="Send"
            size="lg"
            onClick={SendMessage}
            disabled={!canSend}
          />
        </div>
      ) : null}
    </div>
  );
});
export default MessageBar;
