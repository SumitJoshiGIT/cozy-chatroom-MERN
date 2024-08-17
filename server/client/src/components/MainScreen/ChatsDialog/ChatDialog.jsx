import React,{ useState,useEffect,useRef } from "react";
import Titlebar from './TitleBar/TitleBar';
import Chats from './Chats/Chats';
import Options from './Options/Options';
import NewGroup from "./AddGroup/AddGroup";
import socket from "../../Socket";
import { useCtx } from "../AppScreen";

const obj={
     0:Chats,
     1:Options,
     2:NewGroup

}

const ChatDialogComponent=React.memo(function ({}){
    const [dialog,setDialog]=useState(0);
    const {setChatdata}=useCtx();
    const Component=obj[dialog];
    useEffect(()=>{
        socket.on("chat",(datagroup)=>{
            const dict={};
            datagroup.forEach(data=>dict[data._id]=data)
            setChatdata((prev)=>{return {...prev,...dict}});
        })   
        socket.emit('chats',{curr:0}); 
        },[])         
      
    return( <>
    <div className="h-screen border border-r-grey-900 bg-white min-w-96 p-2 w-auto h-full">   
     <Titlebar setDialog={setDialog} />
     {<Component setDialog={setDialog}/>}
    </div> 

    </>);
})

export default ChatDialogComponent;