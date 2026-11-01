import React, { useMemo } from "react";
import { useState, useRef, useEffect } from "react";
import { useCtx } from "../../AppScreen";
import IconButton from "../../../ui/IconButton";
import { useToast } from "../../../ui/Toast";
import send from "/send.svg";
import reply from "/reply.svg";
import edit from "/edit.svg";
import close from "/close.svg";
import fileIcon from "/files.svg";
import EmojiPicker from "./EmojiPicker";
import AttachMenu from "./AttachMenu";
const maxSize = 2*1024*1024;
// Base64 inflates files by a third and the socket caps one packet at 5MB.
const maxTotalSize = 3.5*1024*1024;
// toUTCString() only has one-second resolution, so two quick sends collided
// on one id and the second silently replaced the first.
const newPendingId = () => `pending-${crypto.randomUUID()}`;
// SVG intentionally excluded - see allowedTypes in server/routes/api/socketEvents.js.
const imageTypes = ['image/jpeg','image/png','image/jpg','image/webp'];
const videoTypes = ['video/mp4','video/webm','video/ogg','video/quicktime'];
const audioTypes = ['audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/ogg'];
const docTypes = [
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv','application/zip',
];
const acceptedTypes = [...imageTypes, ...videoTypes, ...audioTypes, ...docTypes];
const MessageBar = React.memo((props) => {
  const { setMessages, db, scrollable, userID, chatID, socket, emitTyping, chatdata, blocked, toggleBlock, drafts, setDraft, e2ee, e2eeStatus, recipientsOf, sealFields, sendSealed }=useCtx();
  const toast=useToast();
  const chat = chatdata[chatID.id] || {};
  const blockedOther = chat.type !== 'group' && chat.sender && blocked.has(chat.sender);

  const [message, setMessage] = useState("");
  const ref = useRef(null);
  const lastTypingEmit = useRef(0);
  const filesRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const maxRecordingSeconds = 180;
  const liveLocationRef = useRef(null); // { messageId, watchId, cid }
  const [liveLocationChat, setLiveLocationChat] = useState(null);

  useEffect(() => {
    return () => {
      if (liveLocationRef.current) {
        navigator.geolocation.clearWatch(liveLocationRef.current.watchId);
        liveLocationRef.current = null;
      }
    };
  }, []);

  function clearLiveLocation() {
    if (liveLocationRef.current) navigator.geolocation.clearWatch(liveLocationRef.current.watchId);
    liveLocationRef.current = null;
    setLiveLocationChat(null);
  }

  // "sealed" is true, false or null while unknown, and only drives what the
  // composer says. sendSealed makes its own decision for every message.
  const [sealed, setSealed] = useState(null);
  useEffect(() => {
    let active = true;
    setSealed(null);
    if (e2ee.current && e2eeStatus === "ready") {
      e2ee.current.willEncrypt(recipientsOf(chatID.id, chatID.type)).then((value) => active && setSealed(value), () => {});
    }
    return () => { active = false; };
  }, [chatID.id, chatID.type, e2eeStatus, (chat.users || []).length]);

  async function sendLocation({ lat, lng, live, durationMs }) {
    if (e2eeStatus === "locked") {
      toast.error("Unlock encryption to send messages.");
      return;
    }
    const encrypted = e2ee.current ? await e2ee.current.willEncrypt(recipientsOf(chatID.id, chatID.type)).catch(() => null) : false;
    if (encrypted === null) {
      toast.error("This chat's encryption could not be checked. Location not sent.");
      return;
    }
    if (encrypted) {
      if (live) {
        toast.error("Live location isn't available in encrypted chats. Share your current location instead.");
        return;
      }
      sendSealed({ event: "sendMessage", cid: chatID.id, type: chatID.type, location: { lat, lng, live: false } });
      return;
    }
    socket.current.emit("sendLocation", { cid: chatID.id, lat, lng, live, durationMs }, (res) => {
      if (!res || !res._id || !live) return;
      clearLiveLocation();
      const cid = chatID.id;
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          socket.current.emit("updateLocation", {
            id: res._id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      liveLocationRef.current = { messageId: res._id, watchId, cid };
      setLiveLocationChat(cid);
      setTimeout(() => {
        if (liveLocationRef.current && liveLocationRef.current.messageId === res._id) clearLiveLocation();
      }, durationMs || 15 * 60 * 1000);
    });
  }

  const sharingLiveLocation = liveLocationChat === chatID.id;

  // Unsent text belongs to its chat: restore it on open, save it as it's typed.
  const draftDebounce = useRef(null);
  useEffect(() => {
    clearTimeout(draftDebounce.current);
    setMessage(drafts[chatID.id] || "");
    setFiles([]);
  }, [chatID.id]);
  function changeDraft(text) {
    const cid = chatID.id;
    clearTimeout(draftDebounce.current);
    draftDebounce.current = setTimeout(() => setDraft(cid, text), 300);
  }

  useEffect(() => {
    if (props.edit) setMessage(props.edit[0].content || "");
  }, [props.edit]);

  async function saveEdit(event) {
    event.preventDefault();
    if (!message.trim()) return;
    const target = props.edit[0];
    const content = message;
    setMessage("");
    props.setEdit();
    if (!target.encrypted) {
      socket.current.emit("editMessage", { id: target._id, cid: chatID.id, content });
      return;
    }
    try {
      const keptFiles = (target.attachments || []).map((a) => ({
        ...a.sealedWith, name: a.name, type: a.contentType, size: a.size,
      }));
      const fields = await sealFields(chatID.id, chatID.type, { content, keptFiles });
      if (!fields.e2ee) throw new Error("This message can't be edited, because someone in the chat no longer has a key.");
      socket.current.emit("editMessage", { id: target._id, cid: chatID.id, e2ee: fields.e2ee });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function SendMessage(event) {
    event.preventDefault();
    if (props.edit) return saveEdit(event);
    if (!message.trim() && files.length === 0) return;
    const id = newPendingId();
    const r2 = props.reply ? props.reply[0]._id : null;
    let msg = {
      _id: id,
      uid: userID.current,
      content: message,
      mid: id,
      chat: chatID.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      reply_to: r2,
      status: "⧖",
      sendQueued: true,
      attachments: files,
    };
    if (db) {
      const cachedMessage = { ...msg };
      delete cachedMessage.sendQueued;
      db.transaction("messages", "readwrite").objectStore("messages").put(cachedMessage);
    }
    setMessages((prev) => {
      const obj = { ...prev };
      obj[chatID.id] = { ...(obj[chatID.id] || {}), ...{ [msg._id]: msg } };
      return obj;
    });
    
    setMessage("");
    setFiles([]);
    clearTimeout(draftDebounce.current);
    setDraft(chatID.id, "");

    sendSealed({
      event: chatID.type === "user" ? "createChatPrivate" : "sendMessage",
      type: chatID.type,
      cid: chatID.id,
      content: msg.content,
      replace: msg._id,
      reply_to: msg.reply_to,
      attachments: msg.attachments,
    });

    if (props.reply) props.setReply();
    if (scrollable.current) scrollable.current.scrollTo(0, scrollable.current.scrollHeight);
  }

  function sendVoiceNote(attachment) {
    const id = newPendingId();
    const msg = {
      _id: id,
      uid: userID.current,
      content: "",
      mid: id,
      chat: chatID.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      reply_to: null,
      status: "⧖",
      sendQueued: true,
      attachments: [attachment],
    };
    if (db) {
      const cachedMessage = { ...msg };
      delete cachedMessage.sendQueued;
      db.transaction("messages", "readwrite").objectStore("messages").put(cachedMessage);
    }
    setMessages((prev) => {
      const obj = { ...prev };
      obj[chatID.id] = { ...(obj[chatID.id] || {}), ...{ [msg._id]: msg } };
      return obj;
    });
    sendSealed({
      event: chatID.type === "user" ? "createChatPrivate" : "sendMessage",
      type: chatID.type,
      cid: chatID.id,
      content: "",
      replace: msg._id,
      reply_to: null,
      attachments: msg.attachments,
    });
    if (scrollable.current) scrollable.current.scrollTo(0, scrollable.current.scrollHeight);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          if (s + 1 >= maxRecordingSeconds) stopRecording(false);
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      toast.error("Couldn't access microphone");
    }
  }

  function stopRecording(cancel) {
    clearInterval(recordingIntervalRef.current);
    setRecording(false);
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (cancel) {
      recorder.onstop = () => recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      recorder.stop();
      return;
    }
    recorder.onstop = () => {
      recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType });
      if (blob.size === 0) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const data = reader.result.split(',')[1];
        sendVoiceNote({ file: data, name: 'voice-message', type: recorder.mimeType, contentType: recorder.mimeType, size: blob.size });
      };
      reader.readAsDataURL(blob);
    };
    recorder.stop();
  }

  useEffect(() => {
    return () => {
      clearInterval(recordingIntervalRef.current);
      if (recordingStreamRef.current) recordingStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.style.height = "auto";
  }, [message]);
  
  const replyTo = useMemo(() => {
    if (props.reply) {
      const m = props.reply[0];
      const p = props.reply[1];

      return (
        <div
          style={{ borderLeftColor: p.color || "var(--accent)" }}
          className="composer-context flex items-center w-full bg-white dark:bg-gray-800 border-l-2 rounded-t-lg rounded-md  mb-2 p-1"
        >
          <img src={reply} className="w-7 h-7 mr-2"></img>
          <div className="flex-1 min-w-0 rounded-md pl-2">
            <div style={{ color: p.color }} className="text-xs font-bold ">
              {p.name}
            </div>
            <div className="h-auto text-sm truncate">{m.content}</div>
          </div>
          <button type="button" aria-label="Cancel reply" onClick={() => props.setReply()} className="p-1">
            <img src={close} className="w-4 h-4 dark:invert dark:opacity-80" alt="" />
          </button>
        </div>
      );
    } else return null;
  }, [props.reply]);

  const editBanner = useMemo(() => {
    if (!props.edit) return null;
    return (
      <div className="composer-context flex items-center w-full bg-white dark:bg-gray-800 border-l-2 border-[var(--accent)] rounded-t-lg rounded-md mb-2 p-1">
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
           let total = files.reduce((sum, file) => sum + (file.size || 0), 0);
           selected.forEach((file) => {
              if (!acceptedTypes.includes(file.type)) {
                toast.error(`${file.name}: unsupported file type`);
                return;
              }
              if (file.size > maxSize) {
                toast.error(`${file.name}: file too large (max 2MB)`);
                return;
              }
              if (total + file.size > maxTotalSize) {
                toast.error(`${file.name}: too much to send at once. Send the rest separately.`);
                return;
              }
              total += file.size;
              const reader = new FileReader();
              reader.onloadend = () => {
                const data = reader.result.split(',')[1];
                setFiles((prev) => [...prev, { file: data, name: file.name, type: file.type, contentType: file.type, size: file.size }]);
              };
              reader.readAsDataURL(file);
           });
           filesRef.current.value = '';
          }
  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function insertEmoji(emoji) {
    const textarea = ref.current;
    const start = textarea ? textarea.selectionStart : message.length;
    const end = textarea ? textarea.selectionEnd : message.length;
    const next = message.slice(0, start) + emoji + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      const cursor = start + emoji.length;
      textarea.setSelectionRange(cursor, cursor);
    });
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
              ) : file.type.startsWith('video/') ? (
                <video src={`data:${file.type};base64,${file.file}`} className="w-full h-full object-cover" />
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
      ) : (chatID.type=='user'||(Array.isArray(chat.users)&&chat.users.includes(userID.current)))? (
        recording ? (
        <div className="p-1.5 rounded-3xl shadow-md bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 w-full flex items-center gap-2 px-4 py-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
            {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => stopRecording(true)}
            aria-label="Cancel recording"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <img src={close} className="w-4 h-4 dark:invert dark:opacity-80" alt="" />
          </button>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            aria-label="Send voice message"
            className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor"><rect width="3" height="12" /><rect x="7" width="3" height="12" /></svg>
          </button>
        </div>
        ) : (
        <div className="message-composer p-1.5 rounded-3xl w-full flex items-end gap-1">
          <input
            ref={filesRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            onChange={handleChange}
            multiple
            className="hidden"
          />
          <AttachMenu
            onPick={(accept) => {
              filesRef.current.accept = accept;
              filesRef.current.click();
            }}
            onSendLocation={sendLocation}
            sharingLiveLocation={sharingLiveLocation}
          />
          <EmojiPicker onPick={insertEmoji} />
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
            aria-label="Message"
            className="pt-2 pb-1.5 align-bottom bg-transparent text-sm max-h-36 w-full outline-none border-none min-h-9 h-auto text-gray-700 dark:text-gray-100 resize-none placeholder-gray-400 dark:placeholder-gray-500"
            placeholder={sealed ? "Encrypted message..." : sealed === false ? "Not encrypted: someone here has no key..." : "Write your message..."}
            type="text"
            onChange={(event) => {
              setMessage(() => event.target.value);
              if (!props.edit) {
                changeDraft(event.target.value);
                const now = Date.now();
                if (now - lastTypingEmit.current > 2000) {
                  lastTypingEmit.current = now;
                  emitTyping(chatID.id);
                }
              }
            }}
            value={message}
          ></textarea>
          <span className="composer-action-slot">
            {canSend ? (
              <IconButton icon={send} alt="Send" size="lg" onClick={SendMessage} />
            ) : (
              <button type="button" onClick={startRecording} aria-label="Record voice message" className="composer-action">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>
            )}
          </span>
        </div>
        )
      ) : null}
    </div>
  );
});
export default MessageBar;
