import TitleBar from "./TitleBar/TitleBar";
import MessageBar from "./MessageBar/MessageBar";
import Message from "./Message/Message";
import {useRef,useEffect} from "react";
import { useCtx } from "../AppScreen";
import backgroundImage from './background.jpg';
import socket from "../../Socket";
export default function MessageDialog(props){
    const {messages,chatID,scrollable}=useCtx()
    
    function throttle(func,timeout){
        let flag=true;
        const context=this; 
        return ()=>{ 
         if(flag){
         flag=false   
         func.apply(context) 
         setTimeout(()=>flag=true,timeout);
        }}
        }
    
    useEffect(()=>{
        // if(scrollable.current&&messages){
            //     let h=scrollable.current.scrollTop;
            //     const interval=setInterval(()=>{
            //          if(h>=scrollable.current.scrollHeight-scrollable.current.clientHeight)clearInterval(interval);
            //          else{scrollable.current.scrollTo(0,h);
            //             h+=10;} 
            //     },5);
            // }
            // return ()=>{}
    
        },[messages])
    
    return( 
    <div className="w-full overflow-hidden"> 
     <TitleBar/>
     <div ref={scrollable} onScroll={function(){
        if(scrollable.current&&scrollable.current.scrollTop<20){ 
             if(messages)
              socket.emit('messages',{cid:chatID.current,mid:messages[0]._id})
            
        }
        }}
         className="h-screen w-full overflow-x-hidden  bg-[url('background.jpg')]" style={{backgroundImage: `url(${backgroundImage})`}}>
        <div  
        className="pt-8 pb-32 flex flex-col w-full  overflow-y-scroll">
            {messages.map((message,index)=>{return <Message key={index} profile={message.profile} item={message}/>})}    
        </div>
    </div>
    
    {(chatID)?<MessageBar></MessageBar>:null}
</div>)
}