import { useState,useEffect,useRef, useCallback, useMemo} from "react";
import Entity from "./Entity";
import socket from "../../../Socket"
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
    <>
     <input ref={ref}  placeholder='Search' className=" border active:outline-none outline-none shadow-sm   rounded-full  w-full h-8 font-roboto p-4"  onChange={onChange}/>
    <div className="flex flex-wrap w-full max-h-36 overflow-y-scroll">
     {additions}
    </div>    
    <div  className=" overflow-y-scroll w-auto">
           {friends}
    </div>
    </>
    );
}