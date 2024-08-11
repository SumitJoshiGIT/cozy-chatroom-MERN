import { useState,useEffect,useRef} from "react";
import Entity from "./Entity";
import socket from "../../../Socket"
export default function (props){
    const [chats,setChats]=useState([])
    const counter=useRef(0);

    socket.on("chat",(datagroup)=>{
        setChats([...chats,...datagroup.map((data)=><Entity img={data.img}  id={data.chat_id} cid={data._id} name={data.name} key={data._id}/>)]);
    })
    useEffect(()=>{
        socket.emit('chats',{curr:counter.current});
        counter.current+=30;
  
        },[])         
    
    return( <div className=" w-auto">
           {chats}
    </div>);
}