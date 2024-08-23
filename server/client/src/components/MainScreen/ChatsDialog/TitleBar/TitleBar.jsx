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
    
//     <button className="rounded-full border outline-none border-none focus:outline-none focus:border-none" onClick={onClick} >
//     <img className="w-12 h-12 border rounded-full p-2" src={src}/>
//  </button>
    const src=((profile.img)?(profile.img.src):single);  
    return( <div className="text-xl  rounded-xl mt-3 flex p-3 pb-0 pl-5  justify-content items-center  w-full">
        <div className="w-full  flex flex-row justify-between">
         <h1 className="text-xl font-bold font-roboto">Messages</h1>
         <button className="rounded-full  outline-none border-none focus:outline-none focus:border-none" onClick={()=>{
            props.setDialog((prev)=>((prev==2)?0:2))
         }} >
            <img className=" h-6  rounded-full" src={add}/>
         </button>
        </div>
        <button></button>
    </div>);
}