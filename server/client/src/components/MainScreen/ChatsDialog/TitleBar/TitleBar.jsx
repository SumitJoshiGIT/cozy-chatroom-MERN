import { useState,useEffect, useCallback, useRef } from "react";
import { useCtx } from "../../AppScreen";
import single from '/single.svg'
import add from '/add.svg'
export default function (props){
    const {profiles,userID}=useCtx();
    const profile=profiles[userID.current]||{}
    const onClick=useCallback(function(){
        props.setDialog((prev)=>prev?0:1);
    },[]);
    const src=((profile.img)?(profile.img.src):single);  
    return( <div className="text-xl shadow-sm flex p-3 pl-5  justify-content items-center bg-white w-full">
        <div className="w-full flex flex-row justify-between">
         <button className="rounded-full border outline-none border-none focus:outline-none focus:border-none" onClick={onClick} >
            <img className="w-12 h-12 border rounded-full p-2" src={src}/>
         </button>
         
         <button className="rounded-full border outline-none border-none focus:outline-none focus:border-none" onClick={()=>{
            props.setDialog((prev)=>((prev==2)?0:2))
         }} >
            <img className="w-12 h-12 border rounded-full p-2" src={add}/>
         </button>
        </div>
        <button></button>
    </div>);
}