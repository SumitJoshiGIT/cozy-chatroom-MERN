import MessageDialog from "./MessageDialog/MessageDialog.jsx";
import ChatDialog from "./ChatsDialog/ChatDialog.jsx";
import {useState,useEffect,useRef,createContext ,useMemo,useContext } from "react";
import socket from '../Socket.js';

const Context=createContext();

function ChatScreen(props) {
   const [profiles,setProfiles]=useState({}); 
   const userID=useRef(null);
   const chatID=useRef({id:null,type:null});
   const [Messages,setMessages]=useState([]);
   const [chatdata,setChatdata]=useState({});
   const [queries,setQueries]=useState({})
   const [contacts,setContacts]=useState(new Set());
   const privateChats=useRef({});
   const scrollable=useRef(null);
 
   useEffect(()=>{
  

      socket.on("userProfile",(data)=>{
          const id=data._id;
          const obj={};
          obj[id]=data; 
          setProfiles((prev)=>{return{...prev,...obj}});
          userID.current=id;
      })
      
      socket.on('profile',(data)=>{
         if(data){
         const id=data._id;      
         const obj={};
         obj[id]=data;
         setProfiles((prev)=>{return{...prev,...obj}});
         }
      })
      socket.on('addFriend',(data)=>{
          setContacts((prev)=>{prev.add(data._id);return prev})
      })
      socket.on('removeFriend',(data)=>{
        setContacts((prev)=>{prev.delete(data._id);return prev})
      })
      
      socket.on('contacts',(stream)=>{
         setContacts(new Set([...contacts.values(),...stream]))
         stream.forEach(contact=>{
             if(!profiles[contact])socket.emit('getProfile',{uid:contact})
            })
      })
      socket.emit('contacts');
      socket.on('logout',(data)=>location.reload());
   },[]);
  
   return(
    <Context.Provider value={{userID,profiles,
      chatdata,
      privateChats,
      setChatdata,
      contacts,
      setMessages,Messages,
      scrollable,
      chatID,
      }}>
    <div className="h-screen w-screen flex flex-row overflow-hidden">
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