import React, { useMemo } from "react";
import { useState, useRef, useEffect } from "react";
import { useCtx } from "../../AppScreen";
import IconButton from "../../../ui/IconButton";
import { useToast } from "../../../ui/Toast";
import attachment from "/attachment.svg";
import send from "/send.svg";
import reply from "/reply.svg";
const maxSize = 2*1024*1024;
const acceptedTypes = ['image/jpeg','image/png','image/jpg','image/webp','image/svg','image/svg+xml'];
const MessageBar = React.memo((props) => {
  const { setMessages, db, scrollable, profiles, userID, chatID, socket }=useCtx();
  const toast=useToast();

  const [message, setMessage] = useState("");
  const ref = useRef(null);
  let [user, setUser] = useState(profiles[userID.current]);
  useEffect(() => {
    setUser(profiles[userID.current]);
  }, [profiles]);
  const filesRef = useRef(null);
  const [files, setFiles] = useState([]);

  async function SendMessage(event) {
    event.preventDefault();
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
          className="flex items-center w-full bg-white border-l-2 rounded-t-lg rounded-md  mb-2 opacity-85 p-1"
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
            <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden shadow-sm border border-gray-200">
              <img src={`data:${file.type};base64,${file.file}`} alt={file.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={()=>removeFile(idx)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center"
              >×</button>
            </div>
          ))}
        </div>
      )}
      {replyTo}
      {user &&(chatID.type=='user'||user.Chats.includes(chatID.id))? (
        <div className="p-1.5 rounded-3xl shadow-md bg-white border border-gray-100 w-full flex items-end gap-1">
          <input
            ref={filesRef}
            type="file"
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
            className="pt-2 pb-1.5 align-bottom bg-transparent text-sm max-h-36 w-full outline-none border-none min-h-9 h-auto text-gray-700 resize-none placeholder-gray-400"
            placeholder="Write your message..."
            type="text"
            onChange={(event) => setMessage(() => event.target.value)}
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
