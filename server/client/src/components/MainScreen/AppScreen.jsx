import MessageDialog from "./MessageDialog/MessageDialog.jsx";
import ChatDialog from "./ChatsDialog/ChatDialog.jsx";
import {useState,useEffect,useRef,createContext ,useContext } from "react";
import socket from '../Socket.js';

const Context=createContext();

function ChatScreen(props) {
   const profiles=useRef({}); 
   const userID=useRef(null);
   const chatID=useRef(null);
   const scrollable=useRef(null);
   useEffect(()=>{
      socket.on("userProfile",(data)=>{
          profiles.current[data._id]=data;
          userID.current=data._id;
      })
      console.log('render')
   },[]);
   const [messages,setMessages]=useState([]);
   return(
    <Context.Provider value={{userID,profiles,messages,scrollable,setMessages,chatID}}>
    <div className="h-screen w-screen flex flex-row">
    <ChatDialog />
    <MessageDialog/>
   </div>
   </Context.Provider>
   );
}
export function useCtx(){
   return useContext(Context);

}
export default ChatScreen;