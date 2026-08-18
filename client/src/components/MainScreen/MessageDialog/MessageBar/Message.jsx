import React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useCtx } from "../../AppScreen";
import { apiOrigin } from "../../../../apiOrigin";
import Avatar from "../../../ui/Avatar";
import forward from "/forward.svg";
import report from "/report.svg";
import reply from "/reply.svg";
import copy from "/copy.svg";
import del from "/delete.svg";
export default function (props) {
  const { profiles, db, userID, Messages, chatID, socket } = useCtx();
  const contextref = useRef();
  const messageItem = props.item;
  if (!messageItem.status) {
    messageItem.status = "✔";
    if (db)
      db.transaction("messages", "readwrite")
        .objectStore("messages")
        .put(messageItem);
  }
  const profile = profiles[messageItem.uid] || {};
  const time = new Date(messageItem.updatedAt);
  const flag = messageItem.uid == userID.current;
  const repliedMessage = props.reply_to
    ? (Messages[chatID.id] || {})[props.reply_to] || messageItem.replyToMessage
    : null;
  const repliedProfile = repliedMessage ? profiles[repliedMessage.uid] || {} : {};

  useEffect(() => {
    if (messageItem.status == "⧖") {
      console.log(
        "pending",
        chatID.type == "user" ? "createChatPrivate" : "sendMessage",
        chatID.type == "user" ? "createChatPrivate" : "sendMessage",
        messageItem
      );
      socket.current.emit(
        chatID.type == "user" ? "createChatPrivate" : "sendMessage",
        {
          cid: messageItem.chat,
          content: messageItem.content,
          replace: messageItem._id,
          reply_to: messageItem.reply_to,
          attachments: messageItem.attachments,
        }
      );
    }
  }, []);
  useEffect(() => {
    //        messageCache
  }, []);

  useEffect(() => {
    if (!profiles[messageItem.uid]) {
      socket.current.emit("getProfile", { uid: messageItem.uid });
    }
  }, [profiles[messageItem.uid]]);

  const handleRight = (event) => {
    event.preventDefault();
    let flag=0
    if (contextref.current) {
      contextref.current.style.display = "block";
      document.addEventListener('click',function click(){
        contextref.current.style.display='none';
        document.removeEventListener('click',click);
      })
      
      document.addEventListener('contextmenu',function rclick(event){
        if(contextref.current.contains(event.target))contextref.current.style.display='none';
        document.removeEventListener('contextmenu',rclick);
      }) 
    }
    flag=1;
    event.preventDefault();
  };
  const onClick = useCallback(() => {
    props.infoPanel.current = messageItem.uid;
    props.setDialog(2);
  }, [profile]);

  const replyHandle = () => {
    props.setReply([messageItem, profile]);
  };
  const copyHandle = () => {
    navigator.clipboard.writeText(messageItem.content);
  };
  const forwardHandle = () => {};
  const reportHandle = () => {};
  const deleteHandle = () => {
    socket.current.emit("deleteMessage", [
      messageItem.mid,
      messageItem._id,
      messageItem.chat,
    ]);
  };

  const grouped = props.pre == messageItem.uid;
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    <div
      id={messageItem._id}
      className={`w-full flex ${grouped ? "mt-0.5" : "mt-2.5"} justify-${flag ? "end" : "start"} animate-fade-in-up`}
    >
      <div className="mr-2 w-7 h-full flex shrink-0">
        {!grouped && !flag && (
          <button
            onClick={onClick}
            className="rounded-full h-fit"
          >
            <Avatar src={profile.img && profile.img.src} size="xs" />
          </button>
        )}
      </div>

      <div onContextMenu={handleRight} className="relative max-w-[75%] md:max-w-[60%]">
        <div
          style={{ backgroundColor: flag ? "#DCF8C6" : "white" }}
          className={`px-2.5 py-1.5 shadow-sm relative
            ${flag
              ? `rounded-2xl ${grouped ? "rounded-tr-2xl" : "rounded-tr-md"}`
              : `rounded-2xl ${grouped ? "rounded-tl-2xl" : "rounded-tl-md"}`}
          `}
        >
          <div>
            {!grouped && !flag && (
              <div
                style={{ color: profile.color }}
                className="text-xs font-bold mb-0.5"
              >
                {profile.name}
              </div>
            )}

            {repliedMessage ? (
              <div
                onClick={() => {
                  const element = document.getElementById(props.reply_to);
                  if (element) element.scrollIntoView({ block: "center" });
                }}
                className="cursor-pointer flex flex-col overflow-clip rounded-md pl-2 py-1 mb-1 bg-black/5 border-l-2 text-xs"
                style={{ borderColor: repliedProfile.color || '#a78bfa' }}
              >
                <p style={{ color: repliedProfile.color }} className="truncate font-bold">{repliedProfile.name || "Unknown"}</p>
                <span className="truncate text-gray-500">
                  {repliedMessage.content}
                </span>
              </div>
            ) : null}

            {messageItem.attachments && messageItem.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {messageItem.attachments.map((a, idx) => (
                  <a key={idx} href={`${apiOrigin}/${a.src}`} target="_blank" rel="noreferrer">
                    <img src={`${apiOrigin}/${a.src}`} alt={a.name} className="max-h-40 max-w-52 rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            )}

            {messageItem.content && (
              <div className="flex items-end gap-2 flex-wrap">
                <span className="text-sm text-gray-800 whitespace-pre-wrap break-words flex-1 min-w-0">
                  {messageItem.content}
                </span>
                <span className="shrink-0 flex items-center gap-0.5 text-[0.65rem] text-gray-400 ml-auto -mb-0.5">
                  {pad(time.getHours())}:{pad(time.getMinutes())}
                  {flag && <span className={messageItem.status === "✔✔" ? "text-purple-500" : ""}>{messageItem.status}</span>}
                </span>
              </div>
            )}
          </div>
        </div>
        <div
          onClick={() => {
            contextref.current.style.display = "none";
          }}
          ref={contextref}
          onMouseLeave={() => {
            contextref.current.style.display = "none";
          }}
          className="font-semibold text-gray-600 absolute text-sm w-40 py-2 h-fit hidden bg-white shadow-lg rounded-lg z-20"
        >
          <button
            onClick={replyHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100"
          >
            <img src={reply} className="w-4 h-4"></img>
            <div>Reply</div>
          </button>
          <button
            onClick={copyHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100"
          >
            <img src={copy} className="w-4 h-4"></img>
            <div>Copy Text</div>
          </button>
          <button
            onClick={forwardHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100"
          >
            <img src={forward} className="w-4 h-4"></img>
            <div>Forward</div>
          </button>

          <button
            onClick={deleteHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100"
          >
            <img src={del} className="w-4 h-4"></img>
            <div>Delete</div>
          </button>

          <button
            onClick={reportHandle}
            className="px-2 py-1.5 items-center gap-2 rounded-lg flex w-full hover:bg-gray-100"
          >
            <img src={report} className="w-4 h-4"></img>
            <div>Report</div>
          </button>
        </div>
      </div>
    </div>
  );
}
