import { useState,useEffect, useCallback, useRef } from "react";
import { useCtx } from "../AppScreen";
import single from '/single.svg'
import add from '/add.svg'
import menu from "/options.svg"
import SettingsButton from "./Settings.jsx";

export default function (props){
    const {profiles,userID,setMessageDialog}=useCtx();
    const profile=profiles[userID.current]||{}
    const onClick=useCallback(function(){
        props.setDialog((prev)=>prev?0:1);
    },[]);

    
//     <button className="rounded-full border outline-none border-none focus:outline-none focus:border-none" onClick={onClick} >
//     <img className="w-12 h-12 border rounded-full p-2" src={src}/>
//  </button>
    const src=((profile.img)?(profile.img.src):single);  
    return( <div style={props.style?{display:'block',width:'40px'}:{}} className="text-xl   rounded-xl mt-3 flex p-2 pb-0   justify-content items-center  w-full">
         <button onClick={()=>{props.setStyle((prev)=>!prev)}} className="min-w-4 ml-1 h-fit w-fit">
            <img  className="min-w-4 opacity-60 w-4 h-6 mt-1" src={menu}/>
         </button>
         <div className="w-full  flex flex-row justify-between">
         <div className="flex items-end">
          {props.style?null:<h1 className="text-xl font-bold opacity-70 font-roboto">Messages</h1>}
          </div>
         
         <div className="flex flex-wrap w-fit h-fit ">   
          <SettingsButton/>
         <button className="rounded-full  outline-none border-none focus:outline-none focus:border-none" onClick={()=>{
            setMessageDialog(4)
         }} >
            <img className=" h-6 min-w-6 rounded-full" src={add}/>
         </button>

         </div> 
        </div>
    </div>);
}