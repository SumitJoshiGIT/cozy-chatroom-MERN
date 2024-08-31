import { useState,useEffect,useRef, useCallback, useMemo} from "react";
import Entity from "./Entity";
import { useCtx } from "../../AppScreen";
import EntityTwo from "./EntityTwo";
export default function (props){
    const {contacts}=useCtx()
    const users=new Set(props.members);
    const ref=useRef();
    const onChange=()=>{

    } 

    
    const friends=useMemo(()=>{
    
    const k=new Array(...contacts)
     return k.map((data)=>{return <Entity  key={data} members={props.members}  setMembers={props.setMembers}id={data}/>})
    },[contacts]) 
    const additions=useMemo(()=>{
       return (new Array(...props.members)).map((member)=><EntityTwo id={member} key={member} members={props.members} setMembers={props.setMembers}></EntityTwo>)
    },[props.members])
    
    return( 
    <div className="h-full flex-1 flex flex-col items-center  w-full">
     <input ref={ref}  placeholder='Search' className=" ring ring-gray-300  max-w-xs shadow-sm   rounded-full  w-full h-8  p-4 relative top-6"  onChange={onChange}/>
    <div className="flex flex-wrap w-full max-h-36 overflow-y-scroll">
     {additions}
    </div>    
    <div className="w-full bg-gray-100 mt-2 rounded-xl h-full ">
    <div  className="flex flex-wrap h-full w-full mt-2  overflow-y-scroll ">
      {friends}
    </div>
    </div>
    </div>
    );
}