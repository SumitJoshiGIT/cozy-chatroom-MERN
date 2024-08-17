import { useState,useEffect,useRef, useCallback, useMemo} from "react";
import Entity from "./Entity";
import socket from "../../../Socket"
import { useCtx } from "../../AppScreen";
import EntityTwo from "./EntityTwo";
export default function (props){
    const {contacts}=useCtx()
    const friends=useMemo(()=>{
     const k=new Array(...contacts)
     return k.map((data)=>{return <Entity  key={data} members={props.members}  setMembers={props.setMembers}id={data}/>})
    },[contacts]) 
    const additions=useMemo(()=>{
       return (new Array(...props.members)).map((member)=><EntityTwo id={member} key={member} members={props.members} setMembers={props.setMembers}></EntityTwo>)
    },[props.members])
    return( 
    <>
    <div className="flex flex-wrap w-full max-h-36 overflow-y-scroll">
     {additions}
    </div>    
    <div  className=" overflow-y-scroll w-auto">
           {friends}
    </div>
    </>
    );
}