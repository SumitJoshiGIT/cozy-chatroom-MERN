import MessageDialog from "./MessageDialog/MessageDialog.jsx";
import ChatDialog from "./ChatsDialog/ChatDialog.jsx";
import {
  useState,
  useEffect,
  useRef,
  createContext,
  useMemo,
  useContext,
} from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
const Context = createContext();

function ChatScreen(props) {


  const [profiles, setProfiles] = useState({});
  const [chatID,setChatID] = useState({ id: false, type: null });
  const [Messages, setMessages] = useState({});
  const [chatdata, setChatdata] = useState({});
  const [contacts, setContacts] = useState(new Set());
  const [messageDialog,setMessageDialog]=useState(0);
  const chatCache = useRef({ query: {}, chats: {} });

  const navigate = useNavigate();
  const userID = useRef(null);
  const privateChats = useRef({});
  const scrollable = useRef(null);
  const socket = useRef(
    io("http://localhost:3000", {
      withCredentials: true,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 4,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 2000,
    })
  );

  const [db, setDb] = useState(null);
  useEffect(() => {
    const openRequest = indexedDB.open("ChatApp", 4

    );
    openRequest.onupgradeneeded = (event) => {
      const db=(event.target.result);
      const names=db.objectStoreNames
//      Object.values(names).forEach((x)=>{db.deleteObjectStore(x)});
      if(!names.contains("chats"))db.createObjectStore("chats", { keyPath: "_id" });
      if(!names.contains("profiles"))db.createObjectStore("profiles", { keyPath: "_id" });
      if(!names.contains("messages"))db.createObjectStore("messages", { keyPath: "_id" });
      setDb(event.target.result);
      console.log("IndexedDB has been created or upgraded");
    };
    openRequest.onerror = (event) => {
      console.log("error met:",event.target.error);
    };
  
    openRequest.onsuccess = (event) => {
      const db=event.target.result
      if(!db)return;
      console.log("Indeasync xedDB has been created")
      db.onversionchange = () => db.close();
      
     
      socket.current.on("auth", async (user) => {
        if (user) {
          const user_id=user._id
          setProfiles({user_id:user})
          userID.current = user_id;
          console.log("Connected as:",user_id)
          //const t=transaction.objectStore("profiles")
          
          const p =await db.transaction("profiles","readwrite").objectStore("profiles").getAll();
          const c =await  db.transaction("chats","readwrite").objectStore("chats").getAll();
          const m = await db.transaction("messages","readwrite").objectStore("messages").getAll();
           
        //  await t.put(data);
          m.onsuccess = (event) => {
            const data = event.target.result;
            setMessages( (prev)=>{
              const store={};
              data.forEach((message) => {  
              if(!store[message.chat])store[message.chat]={}
              store[message.chat][message.mid] = message;
             })
            return {...prev,...store}
            }
            )
          };
          
          c.onsuccess = (event) => {
            const data = event.target.result;
            const store = {};
            data.forEach((chat) => {
              store[chat._id] = chat;
            });
            setChatdata((prev) => {
              return { ...(prev || {}), ...store };
            }
           );
          };

          p.onsuccess = (event) => {
            const data = event.target.result;
            const store = {};
            data.forEach((profile) => {
              store[profile._id]=profile;
            });
           
            setProfiles((prev) => {
              return { ...(prev || {}), ...store };
            });
          };

          socket.current.on(`messages`,async (stream)=>{
            const store={}
            if(stream.data){
               let dat=stream.data  
               dat.forEach((data)=>{
                db.transaction("messages","readwrite").objectStore('messages').put(data);
                store[data.mid]=data;
                if(!profiles[data.uid])socket.current.emit('getProfile',{uid:data.uid}); 
              })
              console.log("recieved",dat)
              setMessages( (prev)=>{
                const store2={...prev};
                if(stream.replace)delete store2[stream.id][stream.replace] 
                store2[stream.id]={...(store2[stream.id]||{}),...store};
                return store2;  
              }
                )  
            }})
            
            
            socket.current.on('leaveChat',([id,del])=>{
              if(chatID.id==id){
                setChatID({id:null,type:null});
                setMessages((prev)=>{
                  const store={...prev}
                  delete store[id];
                  //db.transaction("messages","readwrite").objectStore('messages').delete(id);
                  return {...store}})
              }
              const messages=Object.values(Messages[id]||{})
              messages.forEach(message=>{
                const t=db.transaction("messages","readwrite").objectStore("messages")
                t.delete(message._id)
              })
              setChatdata((prev)=>{
                const data={...prev}
                delete data[id];return {...data}})
               
            })  
      
          socket.current.on('deleteMessage',([id,mid,cid])=>{
            setMessages((prev)=>{
              const store={...(prev||{})};
              try{
                delete store[cid][mid]
              }
              catch(err){console.log(err)}
              return store;
            })
           db.transaction("messages","readwrite").objectStore('messages').delete(id);
          
          })

          socket.current.on("profile", async (data) => {
            if (data) {
              const store =db.transaction("profiles","readwrite").objectStore("profiles");
              const updation =await store.put(data);
              updation.onsuccess = () => {
                const id = data._id;
                const obj = {};
                obj[id] = data;

                setProfiles((prev) => {
                  return { ...prev, ...obj };
                });
              };
            }
          });;  
          socket.current.on("logout", (data) => location.reload());
        
        
        } 
        else {
          socket.current.disconnect();
          navigate("/auth/signin");
        }
      });
    };

   socket.current.on("chat", (datagroup) => { 
      let dict = {};
      datagroup.chats.forEach((data) => {
       if(data){ 
        if (data.type == "private") {
            data.users.forEach((uid) => {
             if (uid != userID.current) {
              privateChats.current[uid] = data._id;
              data.sender = uid;
              if (!profiles[uid])socket.current.emit("getProfile", { uid: uid });
             }
            });
        }
        dict[data._id] = data;
        db.transaction("chats","readwrite").objectStore('chats').put(data)
      }});

      const type = datagroup.type;
      if(datagroup.append)dict={...dict,...chatCache.current.query};
      chatCache.current[type] =type=="query" ?dict: { ...chatCache.current.chats, ...dict };
      
      setChatdata(chatCache.current[datagroup.type] || {});
    }
    
  );

  }, []);
  return (
    <Context.Provider
      value={{
        userID,
        profiles,
        socket,
        db,
        chatdata,
        privateChats,
        setChatdata,
        contacts,setChatID,
        setMessages,messageDialog,
        setMessageDialog,
        Messages,
        chatCache,
        scrollable,
        chatID,
      }}
    >
      <div className="h-screen w-screen flex flex-row overflow-hidden">
        <ChatDialog />
        <MessageDialog />
      </div>
    </Context.Provider>
  );
}
export function useCtx() {
  return useContext(Context);
}
export default ChatScreen;
