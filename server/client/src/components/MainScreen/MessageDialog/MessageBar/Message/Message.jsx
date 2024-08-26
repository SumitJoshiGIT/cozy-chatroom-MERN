import React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import Placeholder from "/person.svg";
import { useCtx } from "../../../AppScreen";
import forward from "/forward.svg";
import report from "/report.svg";
import reply from "/reply.svg";
import copy from "/copy.svg";
import del from "/delete.svg";
export default function (props) {
  const { profiles, userID, socket, messageCache } = useCtx();
  const contextref = useRef();
  const messageItem = props.item;
  const profile = profiles[messageItem.uid] || {};
  const time = new Date(messageItem.updatedAt);
  const flag = messageItem.uid == userID.current;

  useEffect(() => {
    if (!profiles[messageItem.uid]) {
      socket.current.emit("getProfile", { uid: messageItem.uid });
    }
  }, [profiles[messageItem.uid]]);

  const handleRight = (event) => {
    if (contextref.current) {
      const el = contextref.current;
      contextref.current.style.display='block';
      contextref.current.style.left = event.pageX-7 + "px";
      contextref.current.style.top = event.pageY-7 + "px";
      document.addEventListener("mousedown", function fhandler(event) {
        if (!event.target.contains(contextref.current)) {
          contextref.current.style.display='none';
        document.removeEventListener("mousedown", fhandler);
        }
      });
      document.addEventListener("click", function chandler(event) {
        if (!event.target.contains(contextref.current)) {
          contextref.current.style.display='none';
          document.removeEventListener("click", chandler);
        }
      });
    }
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
    socket.current.emit('deleteMessage',[messageItem.mid,messageItem._id,messageItem.chat]);
  };
  //console.log('rt',props.reply_to)
  //<div style={{backgroundColor:((flag)?'#EEFFDE':'white'),maxWidth:'500px'}} className="relative top-1 h-3 w-2 message-clip"></div>
  return (
    <div className={`w-full flex mt-3 justify-${flag ? "end" : "start"}`}>
      <div className="mr-4  w-8 h-full flex ">
        {props.pre != messageItem.uid && (
          <button
            onClick={onClick}
            className="rounded-full h-fit p-1 border border-gray-300"
          >
            <img
              className="min-h-8 min-w-8 w-8  box-shadow border-1 h-8 rounded-full"
              src={profile.img || Placeholder}
              style={{ backgroundColor: "white" }}
            ></img>
          </button>
        )}
      </div>

      <div onContextMenu={handleRight} >
        <div
          style={{
            backgroundColor: flag ? "#EEFFDE" : "white",
            maxWidth: "500px",
          }}
          className=" p-2 pb-1 pl-2 flex flex-wrap pr-2 rounded-xl border shadow"
        >
        <div>
          {props.pre != messageItem.uid && (
            <div style={{ color: profile.color }} className="text-xs font-bold">
              {profile.name}
            </div>
          )}
          {props.reply_to ? (
            <div className="h-4 bg-white w-full">reply_to</div>
          ) : null}
          <pre className="h-fit text-sm flex-1 text-justify text-sans">{messageItem.content}</pre>
         

          <div className="float-right  sticky w-fit flex ml-1 h-fit flex-wrap items-end  text-gray-400 text-xs">
            <div className=" text-grey">
              {time.getHours()}:{time.getMinutes()}{" "}
            </div>
            <div className="text-xs ml-1">{messageItem.status || "✔"}</div>
          </div>
          </div> 
          
          <div
            onClick={()=>{contextref.current.style.display='none'}}
            ref={contextref}
            onMouseLeave={()=>{contextref.current.style.display='none'}}
            className="font-semibold text-gray-500 text-sm w-fit p-2 h-fit fixed  bg-white shadow-lg rounded-lg hidden opacity-80"
          >
            <button
              onClick={replyHandle}
              className="m-1 items-center rounded-lg pl-2 pr-2 flex w-full"
            >
              <img src={reply} className="w-4 h-6  mr-1"></img>
              <div>Reply</div>
            </button>
            <button
              onClick={copyHandle}
              className="m-1 items-center rounded-lg  pl-2 pr-2 flex w-full"
            >
              <img src={copy} className="w-4 h-6 mr-1 mt-1"></img>
              <div>Copy Text</div>
            </button>
            <button
              onClick={forwardHandle}
              className="m-1 items-center rounded-lg  pl-2 pr-2 flex w-full "
            >
              <img src={forward} className="w-4 h-6  mr-1"></img>
              <div>Forward</div>
            </button>

            <button
              onClick={deleteHandle}
              className="m-1 items-center rounded-lg  pl-2 pr-2 flex w-full "
            >
              <img src={del} className="w-4 h-6  mr-1"></img>
              <div>Delete</div>
            </button> 

            <button
              onClick={reportHandle}
              className="m-1 items-center rounded-lg  pl-2 pr-2 flex w-full "
            >
              <img src={report} className="w-4 h-6  mr-1"></img>
              <div>Report</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
